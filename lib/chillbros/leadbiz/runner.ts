import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";
import { contactPageUrls } from "@/lib/chillbros/autopilot/contact-source";
import { pickBusinessEmail } from "@/lib/chillbros/autopilot/email-extract";
import { fetchPage } from "@/lib/chillbros/autopilot/engine";
import { unsubscribeUrl } from "@/lib/chillbros/autopilot/links";
import { isSuppressed } from "@/lib/chillbros/autopilot/store";
import { fetchOverpass } from "@/lib/chillbros/revenue-discovery";

import { buyerFromElement, buyerQuery, inSendWindow, LEADBIZ_BRAND, offerEmail } from "./buyers";

type Client = SupabaseClient;
const TABLE = "chillbros_leadbiz_buyers";
const FOLLOW_UP_DAYS = 5;

export type LeadbizRun = { enabled: boolean; discovered: number; enriched: number; sent: number; followedUp: number; failed: number; note?: string };

function account() {
  const user = String(process.env.LEADBIZ_SMTP_USER || "").trim();
  const password = String(process.env.LEADBIZ_SMTP_APP_PASSWORD || "").replace(/\s+/g, "");
  return user && password ? { user, password, fromName: LEADBIZ_BRAND } : null;
}
const dailyCap = () => Math.max(0, Math.min(50, Number(process.env.LEADBIZ_DAILY_CAP || 25) || 25));
// Each in-window run sends at most this many, spreading the day's cap over the 9–11am runs.
const PER_RUN = 9;

/** Map search for contractor buyers; new businesses only (source_url is unique). */
export async function discoverBuyers(client: Client, deadline: number) {
  const payload = await fetchOverpass(buyerQuery(), deadline);
  const rows = (payload.elements ?? []).map(buyerFromElement).filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (!rows.length) return 0;
  const seen = new Set<string>();
  const fresh = rows.filter((r) => (seen.has(r.source_url) ? false : (seen.add(r.source_url), true)))
    .map((r) => ({ ...r, status: r.email ? "ready" : r.website ? "new" : "no_email" }));
  const { data, error } = await client.from(TABLE).upsert(fresh, { onConflict: "source_url", ignoreDuplicates: true }).select("id");
  if (error) throw new Error(`Buyer save failed: ${error.message}`);
  return data?.length ?? 0;
}

/** Find a published contact email on each new buyer's own website. */
export async function enrichBuyers(client: Client, limit: number, deadline: number) {
  const { data, error } = await client.from(TABLE).select("id,website").eq("status", "new").not("website", "is", null).limit(limit);
  if (error) throw new Error(`Buyer queue unavailable: ${error.message}`);
  let found = 0;
  for (const row of data ?? []) {
    if (Date.now() > deadline) break;
    let email: string | null = null;
    const home = await fetchPage(row.website);
    if (home) {
      email = pickBusinessEmail(home, row.website);
      for (const url of email ? [] : contactPageUrls(home, row.website)) {
        const page = await fetchPage(url);
        email = page ? pickBusinessEmail(page, row.website) : null;
        if (email) break;
      }
    }
    const update = email ? { email, status: "ready", enriched_at: new Date().toISOString() } : { status: "no_email", enriched_at: new Date().toISOString() };
    const { error: saveError } = await client.from(TABLE).update(update).eq("id", row.id);
    if (saveError?.code === "23505") await client.from(TABLE).update({ status: "skipped", last_error: "Duplicate email" }).eq("id", row.id);
    else if (saveError) throw new Error(`Buyer update failed: ${saveError.message}`);
    if (email) found++;
  }
  return found;
}

async function sentToday(client: Client, now: Date) {
  const start = new Date(now.getTime() - 24 * 3600_000).toISOString();
  const [a, b] = await Promise.all([
    client.from(TABLE).select("id", { count: "exact", head: true }).gte("emailed_at", start),
    client.from(TABLE).select("id", { count: "exact", head: true }).gte("followup_at", start),
  ]);
  if (a.error || b.error) throw new Error("Daily send count unavailable; sending is blocked.");
  return (a.count ?? 0) + (b.count ?? 0);
}

async function sendOne(client: Client, row: { id: string; business_name: string; trade: string; email: string }, followUp: boolean, sender: NonNullable<ReturnType<typeof account>>) {
  if (await isSuppressed(client, row.email)) {
    await client.from(TABLE).update({ status: "unsubscribed" }).eq("id", row.id);
    return "skipped" as const;
  }
  // Claim the row first so an overlapping run can never send twice.
  const claim = followUp
    ? await client.from(TABLE).update({ followup_at: new Date().toISOString(), status: "followed_up" }).eq("id", row.id).eq("status", "emailed").is("followup_at", null).select("id")
    : await client.from(TABLE).update({ emailed_at: new Date().toISOString(), status: "emailed" }).eq("id", row.id).eq("status", "ready").select("id");
  if (claim.error || !claim.data?.length) return "skipped" as const;
  const unsub = unsubscribeUrl(row.email).replace("/u?", "/u/leads?");
  const { subject, text } = offerEmail({ business_name: row.business_name, trade: row.trade as never }, unsub, followUp);
  try {
    const result = await sendCompanyEmail(row.email, subject, text, undefined, [], { "List-Unsubscribe": `<${unsub}>` }, sender);
    if (!result.sent) throw new Error(result.error);
    return "sent" as const;
  } catch (error) {
    await client.from(TABLE).update({ last_error: error instanceof Error ? error.message.slice(0, 300) : "send failed" }).eq("id", row.id);
    return "failed" as const;
  }
}

export async function runLeadbizOutreach(client: Client, now = new Date()): Promise<LeadbizRun> {
  const run: LeadbizRun = { enabled: process.env.LEADBIZ_OUTREACH_ENABLED === "1", discovered: 0, enriched: 0, sent: 0, followedUp: 0, failed: 0 };
  const deadline = Date.now() + 240_000;
  // Discovery and enrichment are read-only research and run even while sending is off.
  const { count: queued } = await client.from(TABLE).select("id", { count: "exact", head: true }).in("status", ["new", "ready"]);
  if ((queued ?? 0) < 40) {
    try { run.discovered = await discoverBuyers(client, Math.min(deadline, Date.now() + 60_000)); }
    catch (error) { run.note = error instanceof Error ? error.message : "discovery failed"; }
  }
  run.enriched = await enrichBuyers(client, 20, Math.min(deadline, Date.now() + 120_000));

  const sender = account();
  if (!run.enabled) return { ...run, note: run.note ?? "Sending is off (LEADBIZ_OUTREACH_ENABLED is not 1)." };
  if (!sender) return { ...run, note: "Sender not configured (LEADBIZ_SMTP_USER / LEADBIZ_SMTP_APP_PASSWORD)." };
  if (!inSendWindow(now)) return { ...run, note: "Outside the weekday 9–11am Central send window." };

  let budget = Math.min(PER_RUN, dailyCap() - (await sentToday(client, now)));
  if (budget <= 0) return { ...run, note: "Daily cap reached." };

  const due = new Date(now.getTime() - FOLLOW_UP_DAYS * 86400_000).toISOString();
  const { data: followUps } = await client.from(TABLE).select("id,business_name,trade,email").eq("status", "emailed").is("followup_at", null).lte("emailed_at", due).not("email", "is", null).limit(budget);
  for (const row of followUps ?? []) {
    if (budget <= 0 || Date.now() > deadline) break;
    const r = await sendOne(client, row, true, sender);
    if (r === "sent") { run.followedUp++; budget--; } else if (r === "failed") run.failed++;
  }
  // Mix trades so one trade's buyers don't all go out on the same morning.
  const { data: fresh } = await client.from(TABLE).select("id,business_name,trade,email").eq("status", "ready").not("email", "is", null).order("created_at").limit(200);
  const byTrade = new Map<string, NonNullable<typeof fresh>>();
  for (const row of fresh ?? []) byTrade.set(row.trade, [...(byTrade.get(row.trade) ?? []), row]);
  const queue: NonNullable<typeof fresh> = [];
  while ([...byTrade.values()].some((l) => l.length)) for (const list of byTrade.values()) { const next = list.shift(); if (next) queue.push(next); }
  for (const row of queue) {
    if (budget <= 0 || Date.now() > deadline) break;
    const r = await sendOne(client, row, false, sender);
    if (r === "sent") { run.sent++; budget--; } else if (r === "failed") run.failed++;
  }
  return run;
}
