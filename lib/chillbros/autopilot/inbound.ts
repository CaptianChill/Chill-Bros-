import "server-only";

import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

import { classifyUrgency, composeEmail, draftInboundNudge, draftInboundReply, type Draft } from "./brain";
import { bookingUrl, normalizeContact, unsubscribeUrl } from "./links";
import { getAutopilotSettings, isSuppressed, logOutreach, type AutopilotSettings } from "./store";
import { centralNow } from "./slots";
import { sendAutopilotSms } from "./sms";
import { inboundNudgeDue } from "./timing";

type Client = ReturnType<typeof createServiceRoleClient>;

export type InboundLeadInput = {
  source?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  propertyType?: string | null;
  serviceLine?: string | null;
  message?: string | null;
};

function clean(v: unknown, max: number) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : null;
}

/** Text only in daytime hours, even for replies (8am-9pm Central). */
export function smsHoursOpen(now = new Date()) {
  const h = centralNow(now).hour;
  return h >= 8 && h < 21;
}

async function deliver(client: Client, settings: AutopilotSettings, lead: { id: string; token: string; email: string | null; phone: string | null }, draft: Draft, step: number) {
  const link = bookingUrl({ kind: "l", value: lead.token });
  const results: string[] = [];
  if (lead.email && !(await isSuppressed(client, lead.email))) {
    const body = composeEmail(draft, { bookingUrl: link, unsubscribeUrl: unsubscribeUrl(lead.email), postalAddress: settings.sender_postal_address });
    const sent = await sendCompanyEmail(lead.email, draft.subject, body, undefined, [], { "List-Unsubscribe": `<${unsubscribeUrl(lead.email)}>` })
      .catch((e: unknown) => ({ sent: false as const, status: "failed" as const, error: e instanceof Error ? e.message : String(e) }));
    await logOutreach(client, { lane: "inbound", step, channel: "email", recipient: lead.email, inbound_lead_id: lead.id, subject: draft.subject, body, status: sent.status, error: "error" in sent ? sent.error : null });
    results.push(sent.status);
  }
  if (lead.phone && draft.sms && smsHoursOpen() && !(await isSuppressed(client, lead.phone))) {
    const text = `${draft.sms} ${link} Reply STOP to opt out.`;
    const sent = await sendAutopilotSms(lead.phone, text);
    await logOutreach(client, { lane: "inbound", step, channel: "sms", recipient: normalizeContact(lead.phone), inbound_lead_id: lead.id, body: text, status: sent.status, error: sent.error ?? null });
    results.push(sent.status);
  }
  return results.includes("sent");
}

/** Capture a lead and reply within seconds. Returns the lead id. */
export async function handleInboundLead(input: InboundLeadInput, client: Client = createServiceRoleClient()) {
  const settings = await getAutopilotSettings(client);
  const email = clean(input.email, 320)?.toLowerCase() ?? null;
  const phone = clean(input.phone, 40);
  const message = clean(input.message, 3000);
  const propertyType = input.propertyType === "commercial" || input.propertyType === "residential" ? input.propertyType : null;
  const urgency = classifyUrgency(message);

  // The same person submitting twice within an hour is one lead, not two replies.
  if (email) {
    const { data: dup } = await client.from("chillbros_inbound_leads").select("id").ilike("email", email).gte("created_at", new Date(Date.now() - 3_600_000).toISOString()).limit(1);
    if (dup?.length) return { id: dup[0].id as string, duplicate: true, replied: false };
  }

  const { data: lead, error } = await client.from("chillbros_inbound_leads").insert({
    source: clean(input.source, 60) ?? "website",
    name: clean(input.name, 200),
    email,
    phone,
    address: clean(input.address, 500),
    property_type: propertyType,
    service_line: clean(input.serviceLine, 60),
    message,
    urgency,
  }).select("id,token").single();
  if (error || !lead) throw new Error(error?.message ?? "Could not save the lead.");

  if (!settings.enabled || !settings.inbound_enabled) return { id: lead.id as string, duplicate: false, replied: false };

  const draft = await draftInboundReply(settings, { name: clean(input.name, 200), message, property_type: propertyType, service_line: clean(input.serviceLine, 60), urgency });
  const replied = await deliver(client, settings, { id: lead.id, token: lead.token, email, phone }, draft, 0);
  const now = new Date().toISOString();
  await client.from("chillbros_inbound_leads").update({ status: replied ? "contacted" : "new", ai_reply: draft.body, first_reply_at: replied ? now : null, last_touch_at: now, touch_count: replied ? 1 : 0, updated_at: now }).eq("id", lead.id);
  return { id: lead.id as string, duplicate: false, replied };
}

/** Nudge inbound leads who got a reply but haven't booked. Called by the hourly engine. */
export async function runInboundFollowups(client: Client, settings: AutopilotSettings, limit = 25, now = new Date()) {
  const { data: leads } = await client.from("chillbros_inbound_leads").select("id,token,name,email,phone,touch_count,first_reply_at").eq("status", "contacted").not("first_reply_at", "is", null).lt("touch_count", 4).order("first_reply_at", { ascending: true }).limit(200);
  let sent = 0;
  for (const lead of leads ?? []) {
    if (sent >= limit) break;
    if (!inboundNudgeDue(lead.touch_count, lead.first_reply_at, now)) continue;
    const draft = draftInboundNudge(lead, lead.touch_count - 1);
    const ok = await deliver(client, settings, lead, draft, lead.touch_count);
    const touch = lead.touch_count + 1;
    await client.from("chillbros_inbound_leads").update({ touch_count: touch, last_touch_at: now.toISOString(), status: touch >= 4 ? "lost" : "contacted", updated_at: now.toISOString() }).eq("id", lead.id);
    if (ok) sent++;
  }
  return sent;
}
