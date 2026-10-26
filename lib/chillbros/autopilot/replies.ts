import "server-only";

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";
import { notifyOwner } from "@/lib/chillbros/notify";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

import { composeEmail, draftConversationReply } from "./brain";
import { bookingUrl, unsubscribeUrl } from "./links";
import { intentGetsReply, isAutomatedMessage, REPLY_LIMIT_PER_CONTACT, REPLY_WINDOW_DAYS, replySubject, stripQuoted } from "./replies-logic";
import { logOutreach, suppress, type AutopilotSettings } from "./store";

// The reply desk. Each hourly run reads the company inbox for replies from people the
// autopilot emailed (cold outreach and customer check-ins), and Claude answers them:
// questions answered, nudged toward booking, opt-outs honored, the owner pinged on hot
// leads. Mail from anyone the autopilot never emailed is left alone for the owner.

type Client = ReturnType<typeof createServiceRoleClient>;

export type ReplyDeskRun = { read: number; answered: number; hot: number; handedOff: number; stopped: number };

type Contact = { prospectId: string | null; customerId: string | null; history: { at: string; subject: string | null; body: string | null }[] };

const LOOKBACK_DAYS = 3;
const MAX_PER_RUN = 20;

async function contactedRecently(client: Client) {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data } = await client
    .from("chillbros_outreach_log")
    .select("recipient,prospect_id,customer_id,subject,body,created_at")
    .in("lane", ["cold", "reactivation", "reply"])
    .eq("channel", "email")
    .eq("status", "sent")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(5000);
  const map = new Map<string, Contact>();
  for (const row of data ?? []) {
    const email = String(row.recipient ?? "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    const c = map.get(email) ?? { prospectId: null, customerId: null, history: [] };
    c.prospectId = row.prospect_id ?? c.prospectId;
    c.customerId = row.customer_id ?? c.customerId;
    c.history.push({ at: String(row.created_at).slice(0, 10), subject: row.subject, body: row.body });
    map.set(email, c);
  }
  for (const c of map.values()) c.history = c.history.slice(-4);
  return map;
}

type Incoming = { messageId: string; from: string; fromName: string | null; subject: string | null; date: Date | null; text: string; headers: Record<string, string>; references: string[] };

async function readInbox(user: string, password: string, wanted: Set<string>, handled: (messageId: string) => Promise<boolean>): Promise<Incoming[]> {
  const imap = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user, pass: password }, logger: false, socketTimeout: 30000 });
  const found: Incoming[] = [];
  await imap.connect();
  const lock = await imap.getMailboxLock("INBOX");
  try {
    const uids = (await imap.search({ since: new Date(Date.now() - LOOKBACK_DAYS * 86_400_000) }, { uid: true })) || [];
    if (!uids.length) return found;
    const candidates: number[] = [];
    for await (const msg of imap.fetch(uids, { envelope: true }, { uid: true })) {
      const from = String(msg.envelope?.from?.[0]?.address ?? "").toLowerCase();
      if (wanted.has(from) && msg.envelope?.messageId && !(await handled(msg.envelope.messageId))) candidates.push(msg.uid);
    }
    for (const uid of candidates.slice(0, MAX_PER_RUN)) {
      // fetchOne reads with BODY.PEEK, so the owner still sees these as unread in Gmail.
      const msg = await imap.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) continue;
      const parsed = await simpleParser(msg.source);
      const headers: Record<string, string> = {};
      for (const [k, v] of parsed.headers) headers[k.toLowerCase()] = typeof v === "string" ? v : JSON.stringify(v);
      const refs = Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [];
      found.push({
        messageId: String(parsed.messageId ?? ""),
        from: String(parsed.from?.value?.[0]?.address ?? "").toLowerCase(),
        fromName: parsed.from?.value?.[0]?.name || null,
        subject: parsed.subject ?? null,
        date: parsed.date ?? null,
        text: stripQuoted(parsed.text ?? ""),
        headers,
        references: refs,
      });
    }
  } finally {
    lock.release();
    await imap.logout().catch(() => undefined);
  }
  return found.filter((m) => m.messageId && m.from);
}

export async function runReplyDesk(client: Client, settings: AutopilotSettings): Promise<ReplyDeskRun> {
  const run: ReplyDeskRun = { read: 0, answered: 0, hot: 0, handedOff: 0, stopped: 0 };
  const user = String(process.env.GMAIL_SMTP_USER || "").trim();
  const password = String(process.env.GMAIL_SMTP_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!user || !password) return run;

  // Without the replies table nothing can be marked handled, and the same email would be
  // answered every hour. Stay off until the migration is applied.
  const probe = await client.from("chillbros_email_replies").select("id", { head: true, count: "exact" }).limit(1);
  if (probe.error) {
    console.error("[reply-desk] replies table unavailable; reply desk is off", probe.error.message);
    return run;
  }
  const contacts = await contactedRecently(client);
  if (!contacts.size) return run;
  const handled = async (messageId: string) => {
    const { data, error } = await client.from("chillbros_email_replies").select("id").eq("message_id", messageId).maybeSingle();
    return Boolean(data) || Boolean(error); // when unsure, treat it as handled rather than risk a double reply
  };
  const inbox = await readInbox(user, password, new Set(contacts.keys()), handled);

  for (const m of inbox) {
    const contact = contacts.get(m.from);
    if (!contact) continue;
    run.read++;
    const base = { message_id: m.messageId, from_email: m.from, subject: m.subject, received_at: m.date?.toISOString() ?? null, prospect_id: contact.prospectId, customer_id: contact.customerId, their_text: m.text.slice(0, 4000) };
    const record = async (row: Record<string, unknown>) => {
      const { error } = await client.from("chillbros_email_replies").insert({ ...base, ...row });
      if (error) console.error("[reply-desk] record failed", error.message);
      return !error;
    };
    const prospectPath = contact.prospectId ? `/revenue-radar/${contact.prospectId}` : "/owner/autopilot";
    const who = m.fromName ? `${m.fromName} <${m.from}>` : m.from;

    if (isAutomatedMessage({ from: m.from, subject: m.subject, headers: m.headers }) || !m.text) {
      await record({ action: "ignored", intent: "out_of_office" });
      continue;
    }

    // A real person answered: the cold sequence stops either way.
    const now = new Date().toISOString();
    if (contact.prospectId) await client.from("chillbros_revenue_prospects").update({ outreach_done: true, last_activity_at: now, updated_at: now }).eq("id", contact.prospectId);

    const since = new Date(Date.now() - REPLY_WINDOW_DAYS * 86_400_000).toISOString();
    const { count: repliedCount } = await client.from("chillbros_email_replies").select("id", { count: "exact", head: true }).eq("from_email", m.from).eq("action", "replied").gte("created_at", since);
    const verdict = (repliedCount ?? 0) >= REPLY_LIMIT_PER_CONTACT ? null : await draftConversationReply(settings, { who, existingCustomer: Boolean(contact.customerId && !contact.prospectId), history: contact.history, theirMessage: m.text });

    if (!verdict) {
      run.handedOff++;
      await record({ action: "handed_off", summary: (repliedCount ?? 0) >= REPLY_LIMIT_PER_CONTACT ? "Long back-and-forth; owner takes over" : "Brain could not answer safely" });
      await notifyOwner({ title: "Reply needs you", message: `${who}: ${m.text.slice(0, 100)}`, level: "important", path: prospectPath });
      continue;
    }

    if (verdict.intent === "unsubscribe" || verdict.intent === "not_interested") {
      run.stopped++;
      if (verdict.intent === "unsubscribe") await suppress(client, m.from, "replied unsubscribe");
      if (contact.prospectId) {
        await client.from("chillbros_revenue_prospects").update(verdict.intent === "unsubscribe"
          ? { do_not_contact: true, do_not_contact_reason: "Asked to stop (email reply)", sales_status: "do_not_contact" }
          : { sales_status: "lost", status_reason: `Replied: ${verdict.summary}`.slice(0, 300) }).eq("id", contact.prospectId);
      }
      await record({ action: verdict.intent === "unsubscribe" ? "unsubscribed" : "stopped", intent: verdict.intent, summary: verdict.summary });
      continue;
    }

    if (!intentGetsReply(verdict.intent)) {
      await record({ action: "ignored", intent: verdict.intent, summary: verdict.summary });
      continue;
    }

    const body = composeEmail({ subject: "", body: verdict.reply, sms: null, source: "ai" }, {
      bookingUrl: bookingUrl(contact.prospectId ? { kind: "p", value: contact.prospectId } : contact.customerId ? { kind: "c", value: contact.customerId } : undefined),
      unsubscribeUrl: unsubscribeUrl(m.from),
      postalAddress: settings.sender_postal_address,
    });
    const subject = replySubject(m.subject);
    const threadHeaders = { "In-Reply-To": m.messageId, References: [...m.references, m.messageId].slice(-10).join(" "), "List-Unsubscribe": `<${unsubscribeUrl(m.from)}>` };
    const result = await sendCompanyEmail(m.from, subject, body, undefined, [], threadHeaders)
      .catch((e: unknown) => ({ sent: false as const, status: "failed" as const, error: e instanceof Error ? e.message : String(e) }));
    await logOutreach(client, { lane: "reply", channel: "email", recipient: m.from, prospect_id: contact.prospectId, customer_id: contact.customerId, subject, body, status: result.status, error: "error" in result ? result.error : null });
    if (result.status !== "sent") {
      // Not recorded, so the next run tries this reply again.
      console.error(`[reply-desk] send failed: ${"error" in result ? result.error : "unknown"}`);
      break;
    }
    run.answered++;
    const saved = await record({ action: "replied", intent: verdict.intent, hot: verdict.hot, summary: verdict.summary, our_reply: body.slice(0, 4000) });
    if (verdict.hot) {
      run.hot++;
      if (contact.prospectId) await client.from("chillbros_revenue_prospects").update({ sales_status: "qualified" }).eq("id", contact.prospectId);
      await notifyOwner({ title: "Hot lead replied", message: verdict.summary || `${who} wants service`, level: "important", path: prospectPath });
    }
    if (!saved) break; // could not mark it answered: stop rather than risk answering twice
  }
  return run;
}
