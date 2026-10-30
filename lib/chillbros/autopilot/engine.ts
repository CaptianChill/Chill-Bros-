import "server-only";

import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";
import { notifyOwner } from "@/lib/chillbros/notify";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

import { composeEmail, draftColdEmail, draftReactivation, type Draft } from "./brain";
import { isInternalOrTestCustomer } from "./audience";
import { osmIdentity, phoneFromHtml } from "./contact-source";
import { isUsableOutreachEmail, pickBusinessEmail, websiteFromSummary } from "./email-extract";
import { runInboundFollowups } from "./inbound";
import { runReplyDesk } from "./replies";
import { replyHoursOpen } from "./replies-logic";
import { bookingUrl, unsubscribeUrl } from "./links";
import { centralNow, openSlotCount } from "./slots";
import { finishOutreach, getAutopilotSettings, isSuppressed, loadOpenSlots, logOutreach, reserveOutreach, sentTodayCount, type AutopilotSettings } from "./store";
import { batchSize, coldStepDue, COLD_MAX_STEPS, laneForServiceLine, laneIsOpen, REACTIVATION_GAP_DAYS } from "./timing";

// The hourly engine. Every run: find more contact emails, nudge inbound leads, and
// send each outreach lane only inside its best window, sized to the open schedule.

type Client = ReturnType<typeof createServiceRoleClient>;

export type AutopilotRun = {
  ranAt: string;
  centralHour: number;
  openSlots5Days: number;
  enriched: number;
  inboundFollowups: number;
  reactivation: number;
  cold: number;
  replies: { read: number; answered: number; hot: number; handedOff: number; stopped: number };
  notes: string[];
};

async function sendEmail(to: string, draft: Draft, body: string) {
  return sendCompanyEmail(to, draft.subject, body, undefined, [], { "List-Unsubscribe": `<${unsubscribeUrl(to)}>` })
    .catch((e: unknown) => ({ sent: false as const, status: "failed" as const, error: e instanceof Error ? e.message : String(e) }));
}

// ---------- enrichment ----------

function safePublicUrl(url: string) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^[\d.]+$/.test(h) || h.includes(":")) return null;
    return u;
  } catch {
    return null;
  }
}

async function fetchPage(url: string) {
  const u = safePublicUrl(url);
  if (!u) return "";
  try {
    const res = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(6000), headers: { "user-agent": "Mozilla/5.0 (compatible; ChillProsBot/1.0; +https://chill-bros.vercel.app)" }, cache: "no-store" });
    if (!res.ok || !String(res.headers.get("content-type") || "").includes("html")) return "";
    const text = await res.text();
    return text.slice(0, 600_000);
  } catch {
    return "";
  }
}

export async function enrichProspectEmails(client: Client, limit = 30) {
  const retryBefore = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: rows, error: queueError } = await client
    .from("chillbros_revenue_prospects")
    .select("id,signal_summary,source_url,contact_email,contact_phone")
    .or(`contact_enriched_at.is.null,contact_enriched_at.lt.${retryBefore}`)
    .eq("do_not_contact", false)
    .order("contact_enriched_at", { ascending: true, nullsFirst: true })
    .order("score", { ascending: false })
    .limit(limit);
  if (queueError || rows === null) throw new Error("Enrichment queue could not be read.");
  const identities = rows.map((r) => osmIdentity(r.source_url)).filter((r) => r !== null);
  const tagsBySource = new Map<string, Record<string, string>>();
  if (identities.length) {
    const query = `[out:json][timeout:15];(${identities.map((r) => `${r.type}(${r.id});`).join("")});out tags;`;
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST", body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(20000), cache: "no-store",
    });
    if (!response.ok) throw new Error(`Contact source returned ${response.status}; queue retained for retry.`);
    const payload = await response.json() as { elements?: { type: string; id: number; tags?: Record<string, string> }[] };
    if (!Array.isArray(payload.elements)) throw new Error("Invalid contact source; queue retained for retry.");
    for (const e of payload.elements) tagsBySource.set(`${e.type}/${e.id}`, e.tags ?? {});
  }
  let found = 0;
  const queue = [...(rows ?? [])];
  const worker = async () => {
    while (queue.length) {
      const row = queue.shift()!;
      const identity = osmIdentity(row.source_url);
      const tags = identity ? tagsBySource.get(`${identity.type}/${identity.id}`) ?? {} : {};
      const sourceSite = tags.website || tags["contact:website"];
      const site = websiteFromSummary(row.signal_summary) || (sourceSite ? (/^https?:\/\//.test(sourceSite) ? sourceSite : `https://${sourceSite}`) : null);
      let phone: string | null = row.contact_phone || tags.phone || tags["contact:phone"] || null;
      let email: string | null = null;
      const sourceEmail = tags.email || tags["contact:email"];
      if (isUsableOutreachEmail(sourceEmail)) email = sourceEmail.toLowerCase();
      if (site) {
        const home = await fetchPage(site);
        email ||= pickBusinessEmail(home, site);
        phone ||= phoneFromHtml(home);
        if (!email) {
          for (const path of ["/contact", "/contact-us"]) {
            const page = await fetchPage(new URL(path, site).toString());
            phone ||= phoneFromHtml(page);
            email = pickBusinessEmail(page, site);
            if (email) break;
          }
        }
      }
      const now = new Date().toISOString();
      const { error } = await client.from("chillbros_revenue_prospects").update({ contact_enriched_at: now, ...(site ? { email_enriched_at: now } : {}), ...(!row.contact_email && email ? { contact_email: email } : {}), ...(!row.contact_phone && phone ? { contact_phone: phone } : {}) }).eq("id", row.id);
      if (error) throw new Error("Enrichment result could not be saved.");
      if ((!row.contact_email && email) || (!row.contact_phone && phone)) found++;
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  if (rows?.length) await logOutreach(client, { lane: "enrichment", channel: "none", status: "checked", subject: `Checked ${rows.length} lead sources, enriched ${found} contacts` });
  return found;
}

// ---------- reactivation ----------



async function runReactivation(client: Client, settings: AutopilotSettings, count: number) {
  if (count <= 0) return 0;
  const since = new Date(Date.now() - REACTIVATION_GAP_DAYS * 86_400_000).toISOString();
  const [{ data: customers }, { data: recentLogs }, { data: recentJobs }] = await Promise.all([
    client.from("chillbros_customers").select("id,name,email").not("email", "is", null).neq("email", ""),
    client.from("chillbros_outreach_log").select("customer_id").eq("lane", "reactivation").gte("created_at", since),
    client.from("chillbros_jobs").select("customer_id,scope,status,created_at").is("archived_at", null).order("created_at", { ascending: false }).limit(3000),
  ]);
  const contacted = new Set((recentLogs ?? []).map((r) => r.customer_id));
  const latest = new Map<string, { scope: string | null; created_at: string; status: string }>();
  const open = new Set<string>();
  for (const j of recentJobs ?? []) {
    if (!latest.has(j.customer_id)) latest.set(j.customer_id, j);
    if (!["completed", "cancelled", "paid", "work_complete", "invoice_sent", "ready_to_invoice"].includes(String(j.status))) open.add(j.customer_id);
  }

  // One person can sit on several customer records (multiple locations). Judge them by
  // the email: if ANY record under that email has open work, a recent visit, or a recent
  // check-in, nobody under it gets one.
  const primaryEmail = (value: unknown) => String(value ?? "").split(/[,;\s]+/)[0].trim().toLowerCase();
  const byEmail = new Map<string, { ids: string[]; lastVisit: number; open: boolean; contacted: boolean }>();
  for (const c of customers ?? []) {
    const email = primaryEmail(c.email);
    if (!email.includes("@")) continue;
    const group = byEmail.get(email) ?? { ids: [], lastVisit: 0, open: false, contacted: false };
    group.ids.push(c.id);
    const last = latest.get(c.id);
    if (last) group.lastVisit = Math.max(group.lastVisit, new Date(last.created_at).getTime());
    if (open.has(c.id)) group.open = true;
    if (contacted.has(c.id)) group.contacted = true;
    byEmail.set(email, group);
  }
  const recentCutoff = Date.now() - 60 * 86_400_000;
  const eligible = (customers ?? []).filter((c) => {
    const email = primaryEmail(c.email);
    const group = byEmail.get(email);
    if (!group || group.open || group.contacted) return false;
    if (isInternalOrTestCustomer(c.name, email)) return false;
    return group.lastVisit === 0 || group.lastVisit < recentCutoff; // no visit in 60 days on any of their records
  });

  const seenEmails = new Set<string>();
  let sent = 0;
  for (const c of eligible) {
    if (sent >= count) break;
    const email = primaryEmail(c.email);
    if (!email.includes("@") || seenEmails.has(email) || (await isSuppressed(client, email))) continue;
    seenEmails.add(email);
    const last = latest.get(c.id);
    const months = last ? Math.round((Date.now() - new Date(last.created_at).getTime()) / (30 * 86_400_000)) : null;
    const draft = await draftReactivation(settings, { name: c.name, lastWork: last?.scope ?? null, monthsSince: months });
    const body = composeEmail(draft, { bookingUrl: bookingUrl({ kind: "c", value: c.id }), unsubscribeUrl: unsubscribeUrl(email), postalAddress: settings.sender_postal_address });
    const reservation = await reserveOutreach(client, `reactivation:${email}:${new Date().toISOString().slice(0, 10)}`, { lane: "reactivation", channel: "email", recipient: email, customer_id: c.id, subject: draft.subject, body });
    if (!reservation) continue;
    const result = await sendEmail(email, draft, body);
    await finishOutreach(client, reservation, result.status, "error" in result ? result.error : null);
    if (result.status === "sent") sent++;
    else if (result.status === "configuration_required") break;
  }
  return sent;
}

// ---------- cold commercial email ----------

/** Listings scored below this are usually national chains or hotels with corporate vendors. */
const COLD_MIN_SCORE = 70;

async function runCold(client: Client, settings: AutopilotSettings, allowance: { cold_kitchen: number; cold_office: number }) {
  const total = allowance.cold_kitchen + allowance.cold_office;
  if (total <= 0) return 0;
  const [{ data: prospects }, { data: customers }] = await Promise.all([
    client
      .from("chillbros_revenue_prospects")
      .select("id,business_name,city,service_line,signal_summary,contact_name,contact_email,outreach_step,outreach_last_at,score,sales_status")
      .eq("do_not_contact", false)
      .eq("outreach_done", false)
      .not("contact_email", "is", null)
      .neq("contact_email", "")
      .order("outreach_step", { ascending: false }) // finish sequences already started first
      .order("score", { ascending: false })
      .limit(500),
    client.from("chillbros_customers").select("email").not("email", "is", null),
  ]);
  const customerEmails = new Set((customers ?? []).flatMap((c) => String(c.email).toLowerCase().split(/[,;\s]+/)));
  const used = { cold_kitchen: 0, cold_office: 0 };
  const seenEmails = new Set<string>();
  let sent = 0;

  for (const p of prospects ?? []) {
    if (used.cold_kitchen >= allowance.cold_kitchen && used.cold_office >= allowance.cold_office) break;
    if (["won", "lost", "do_not_contact"].includes(String(p.sales_status ?? ""))) continue;
    const lane = laneForServiceLine(p.service_line);
    if (used[lane] >= allowance[lane]) continue;
    const email = String(p.contact_email).trim().toLowerCase();
    if (seenEmails.has(email) || customerEmails.has(email)) continue;
    if (!isUsableOutreachEmail(email) || Number(p.score ?? 0) < COLD_MIN_SCORE) {
      // Placeholder/third-party/wrong-department address, or a low-fit (chain/hotel) listing.
      await client.from("chillbros_revenue_prospects").update({ outreach_done: true, status_reason: Number(p.score ?? 0) < COLD_MIN_SCORE ? "Autopilot skipped: low-fit listing" : "Autopilot skipped: unusable email address" }).eq("id", p.id);
      continue;
    }
    if (!coldStepDue(p.outreach_step, p.outreach_last_at)) continue;
    seenEmails.add(email);
    // The same inbox can sit on several listings (locations, duplicates). Only one sequence per inbox.
    const { data: other } = await client.from("chillbros_outreach_log").select("prospect_id").eq("lane", "cold").eq("recipient", email).neq("prospect_id", p.id).limit(1);
    if (other?.length) {
      await client.from("chillbros_revenue_prospects").update({ outreach_done: true, status_reason: "Autopilot skipped: same inbox already in a sequence" }).eq("id", p.id);
      continue;
    }
    if (await isSuppressed(client, email)) {
      await client.from("chillbros_revenue_prospects").update({ outreach_done: true, do_not_contact: true, do_not_contact_reason: "Unsubscribed" }).eq("id", p.id);
      continue;
    }

    const step = p.outreach_step;
    const draft = await draftColdEmail(settings, p, step);
    const body = composeEmail(draft, { bookingUrl: bookingUrl({ kind: "p", value: p.id }), unsubscribeUrl: unsubscribeUrl(email), postalAddress: settings.sender_postal_address });
    const reservation = await reserveOutreach(client, `cold:${email}:${step}`, { lane: "cold", step, channel: "email", recipient: email, prospect_id: p.id, subject: draft.subject, body });
    if (!reservation) continue;
    const result = await sendEmail(email, draft, body);
    await finishOutreach(client, reservation, result.status, "error" in result ? result.error : null);
    if (result.status === "configuration_required") break;
    const now = new Date().toISOString();
    if (result.status === "sent") {
      const nextStep = step + 1;
      await client.from("chillbros_revenue_prospects").update({
        outreach_step: nextStep,
        outreach_last_at: now,
        outreach_done: nextStep >= COLD_MAX_STEPS,
        sales_status: p.sales_status && p.sales_status !== "new" ? p.sales_status : "contacted",
        last_activity_at: now,
        updated_at: now,
      }).eq("id", p.id);
      used[lane]++;
      sent++;
    } else {
      // Sending failed (mail server or connection problem, not this prospect's fault):
      // stop this run and retry the same prospect next run instead of burning the list.
      console.error(`[autopilot] cold send failed, stopping run: ${"error" in result ? result.error : "unknown"}`);
      break;
    }
  }
  return sent;
}

// ---------- the run ----------

export async function runAutopilot(now = new Date()): Promise<AutopilotRun> {
  const client = createServiceRoleClient();
  const settings = await getAutopilotSettings(client);
  const ct = centralNow(now);
  const run: AutopilotRun = { ranAt: now.toISOString(), centralHour: ct.hour, openSlots5Days: 0, enriched: 0, inboundFollowups: 0, reactivation: 0, cold: 0, replies: { read: 0, answered: 0, hot: 0, handedOff: 0, stopped: 0 }, notes: [] };
  // Lead finding never sleeps: keep turning websites into reachable contacts.
  run.enriched = await enrichProspectEmails(client, 30).catch((e) => { console.error("[autopilot] enrichment failed", e); run.notes.push("Contact enrichment failed; queue retained for retry."); return 0; });

  if (!settings.enabled || settings.outreach_approval_hold) {
    run.notes.push("Customer outreach is on hold; contact enrichment remains active.");
    return run;
  }

  // Replies to our emails get answered first, every daytime hour, even when the schedule is full.
  if (settings.reply_enabled && replyHoursOpen(ct.hour)) {
    run.replies = await runReplyDesk(client, settings).catch((e) => { console.error("[autopilot] reply desk failed", e); return run.replies; });
  }

  const slots = await loadOpenSlots(client, settings, now);
  run.openSlots5Days = openSlotCount(slots, ct.date, 5);

  if (settings.inbound_enabled && laneIsOpen("inbound_followup", ct.weekday, ct.hour)) {
    run.inboundFollowups = await runInboundFollowups(client, settings, 25, now).catch((e) => { console.error("[autopilot] inbound follow-ups failed", e); return 0; });
  }

  if (run.openSlots5Days <= 0) {
    run.notes.push("Schedule is full for the next 5 days; outreach paused.");
    return run;
  }

  if (settings.reactivation_enabled) {
    const n = batchSize({ lane: "reactivation", weekday: ct.weekday, hour: ct.hour, openSlots: run.openSlots5Days, sendsPerSlot: settings.sends_per_open_slot, dailyCap: settings.reactivation_daily_cap, sentToday: await sentTodayCount(client, "reactivation", now) });
    run.reactivation = await runReactivation(client, settings, n).catch((e) => { console.error("[autopilot] reactivation failed", e); return 0; });
  }

  if (settings.cold_email_enabled) {
    const sentToday = await sentTodayCount(client, "cold", now);
    const common = { weekday: ct.weekday, hour: ct.hour, openSlots: run.openSlots5Days, sendsPerSlot: settings.sends_per_open_slot, dailyCap: settings.cold_daily_cap, sentToday };
    const kitchen = batchSize({ lane: "cold_kitchen", ...common });
    const office = batchSize({ lane: "cold_office", ...common });
    // Both lanes share one daily cap.
    const room = Math.max(0, settings.cold_daily_cap - sentToday);
    run.cold = await runCold(client, settings, { cold_kitchen: Math.min(kitchen, room), cold_office: Math.min(office, Math.max(0, room - kitchen)) }).catch((e) => { console.error("[autopilot] cold outreach failed", e); return 0; });
  }

  if (run.cold + run.reactivation > 0) {
    await notifyOwner({
      title: `Autopilot sent ${run.cold + run.reactivation} email${run.cold + run.reactivation === 1 ? "" : "s"}`,
      message: [run.cold ? `${run.cold} new businesses` : null, run.reactivation ? `${run.reactivation} check-ins` : null].filter(Boolean).join(" · "),
      level: "low",
      path: "/owner/autopilot",
    });
  }

  return run;
}
