import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";
import { contactPageUrls, phoneFromHtml } from "@/lib/chillbros/autopilot/contact-source";
import { pickBusinessEmail } from "@/lib/chillbros/autopilot/email-extract";
import { fetchPage } from "@/lib/chillbros/autopilot/engine";
import { unsubscribeUrl } from "@/lib/chillbros/autopilot/links";
import { isSuppressed } from "@/lib/chillbros/autopilot/store";
import { searchPlacesTransient } from "@/lib/chillbros/google-places";
import { fetchOverpass, SCAN_AREAS, type OsmElement } from "@/lib/chillbros/revenue-discovery";

import { fetchAllLicenses } from "./licenses";
import { buyerFromElement, buyerFromOwnSite, buyerQueries, GOOGLE_TRADE_QUERIES, googleRotation, inSendWindow, isContractorName, LEADBIZ_BRAND, offerEmail, perRunFor, rampCap, type BuyerRow } from "./buyers";

type Client = SupabaseClient;
const TABLE = "chillbros_leadbiz_buyers";
const FOLLOW_UP_DAYS = 5;

export type LeadbizRun = { enabled: boolean; licenses?: string; google?: string; mapped?: number; discovered: number; enriched: number; sent: number; followedUp: number; failed: number; note?: string };

function account() {
  const user = String(process.env.LEADBIZ_SMTP_USER || "").trim();
  const password = String(process.env.LEADBIZ_SMTP_APP_PASSWORD || "").replace(/\s+/g, "");
  return user && password ? { user, password, fromName: LEADBIZ_BRAND } : null;
}
// LEADBIZ_DAILY_CAP is a ceiling (max 100); the warm-up ramp in rampCap sets the actual pace.
const envCap = () => Math.max(0, Math.min(100, Number(process.env.LEADBIZ_DAILY_CAP || 100) || 100));
async function firstSentAt(client: Client) {
  const { data } = await client.from(TABLE).select("emailed_at").not("emailed_at", "is", null).order("emailed_at").limit(1);
  const at = data?.[0]?.emailed_at;
  return at ? new Date(at) : null;
}
// Google searches per discovery run (each one a different trade/area from the rotation).
const GOOGLE_SEARCHES_PER_RUN = 2;

const CONTRACTORS = "chillbros_leadbiz_contractors";

/** Daily refresh of the state license lists (electricians, sign companies, plumbers, pest control)
 *  behind the Lead Buyers call list and its PDFs. Skips when refreshed in the last 20 hours. */
export async function refreshContractors(client: Client, now = new Date()) {
  const { data: last } = await client.from(CONTRACTORS).select("refreshed_at").order("refreshed_at", { ascending: false }).limit(1);
  const lastAt = last?.[0]?.refreshed_at ? new Date(last[0].refreshed_at).getTime() : 0;
  if (now.getTime() - lastAt < 20 * 3600_000) return null;
  const { buyers, failed } = await fetchAllLicenses();
  const stamp = now.toISOString();
  const rows = [...new Map(buyers.map((b) => [b.license, { license: b.license, trade: b.trade, name: b.name.slice(0, 200), phone: b.phone || null, address: b.address || null, contact: b.contact || null, source: b.source ?? "state", refreshed_at: stamp }])).values()];
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await client.from(CONTRACTORS).upsert(rows.slice(i, i + 500), { onConflict: "license" });
    if (error) throw new Error(`Contractor save failed: ${error.message}`);
  }
  // Licenses that dropped off every list for a week are expired; only prune when all sources loaded.
  if (!failed.length) await client.from(CONTRACTORS).delete().lt("refreshed_at", new Date(now.getTime() - 7 * 86400_000).toISOString());
  return `${rows.length} contractors${failed.length ? `, failed: ${failed.join(",")}` : ""}`;
}

/** Map search for contractor buyers; new businesses only (source_url is unique). */
export async function discoverBuyers(client: Client, deadline: number, run?: LeadbizRun) {
  const elements: OsmElement[] = [];
  const failures: string[] = [];
  for (const query of buyerQueries()) {
    if (Date.now() > deadline - 5000) break;
    try { elements.push(...((await fetchOverpass(query, deadline)).elements ?? [])); }
    catch (error) { failures.push(error instanceof Error ? error.message.slice(0, 120) : "map search failed"); }
  }
  if (run) { run.mapped = elements.length; if (failures.length) run.note = `map searches failed: ${failures.length}`; }
  const rows = elements.map(buyerFromElement).filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (!rows.length) return 0;
  const seen = new Set<string>();
  const fresh = rows.filter((r) => (seen.has(r.source_url) ? false : (seen.add(r.source_url), true)))
    .map((r) => ({ ...r, status: r.email ? "ready" : r.website ? "new" : "no_email" }));
  const { data, error } = await client.from(TABLE).upsert(fresh, { onConflict: "source_url", ignoreDuplicates: true }).select("id");
  if (error) throw new Error(`Buyer save failed: ${error.message}`);
  return data?.length ?? 0;
}

/** Reads a business's OWN website (home page, then its contact/about pages) for its published email and phone. */
async function readOwnSite(site: string) {
  const html = await fetchPage(site);
  if (!html) return { html: "", email: null, phone: null };
  let email = pickBusinessEmail(html, site);
  let phone = phoneFromHtml(html);
  for (const url of email && phone ? [] : contactPageUrls(html, site)) {
    const page = await fetchPage(url);
    if (!page) continue;
    email ||= pickBusinessEmail(page, site);
    phone ||= phoneFromHtml(page);
    if (email && phone) break;
  }
  return { html, email, phone };
}

/** One Google Places search per run (a different trade/area each time), when a key is configured. */
export async function discoverBuyersGoogle(client: Client, deadline: number, run?: LeadbizRun, slot = 0) {
  const key = String(process.env.GOOGLE_PLACES_API_KEY || "").trim();
  if (!key) return 0;
  const { count } = await client.from("chillbros_leadbiz_runs").select("id", { count: "exact", head: true });
  const { trade, area } = googleRotation((count ?? 0) * GOOGLE_SEARCHES_PER_RUN + slot, SCAN_AREAS.length);
  const where = SCAN_AREAS[area];
  // Google rule: transient lookup only. Google's results are used here, in memory, just to
  // find each contractor's own website. We save only what that website publishes (name,
  // email, phone) plus the website URL and Google place_id. Google's name, phone, address,
  // rating, hours, etc. are never saved (Maps Platform terms forbid storing Places content).
  const places = await searchPlacesTransient(key, `${GOOGLE_TRADE_QUERIES[trade]} in ${where.name}, San Antonio TX`, {
    pageSize: 20, bias: where, timeoutMs: Math.min(20_000, deadline - Date.now() - 2000),
  });
  if (run) run.google = `${run.google ? `${run.google}; ` : ""}${trade} @ ${where.name}: ${places.length}`;
  const queue = places.filter((p) => p.operational && p.website && isContractorName(p.name));
  const rows: BuyerRow[] = [];
  const worker = async () => {
    while (queue.length && Date.now() < deadline - 3000) {
      const place = queue.shift()!;
      const site = await readOwnSite(place.website!);
      const row = buyerFromOwnSite({ placeId: place.id, trade, website: place.website!, ...site });
      if (row) rows.push(row);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  let saved = 0;
  const now = new Date().toISOString();
  for (const row of rows) {
    const { data, error } = await client.from(TABLE)
      .upsert({ ...row, status: row.email ? "ready" : "no_email", enriched_at: now }, { onConflict: "source_url", ignoreDuplicates: true }).select("id");
    if (error?.code === "23505") continue; // Email already on another buyer row.
    if (error) throw new Error(`Buyer save failed: ${error.message}`);
    saved += data?.length ?? 0;
  }
  return saved;
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
  const { subject, text, html } = offerEmail({ business_name: row.business_name, trade: row.trade as never }, unsub, followUp);
  try {
    const result = await sendCompanyEmail(row.email, subject, text, html, [], { "List-Unsubscribe": `<${unsub}>` }, sender);
    if (!result.sent) throw new Error(result.error);
    return "sent" as const;
  } catch (error) {
    // The email did not go out: undo the claim so the row is retried (and never gets a
    // follow-up for an offer it never received), and keep the error for the owner page.
    const undo = followUp ? { followup_at: null, status: "emailed" } : { emailed_at: null, status: "ready" };
    await client.from(TABLE).update({ ...undo, last_error: error instanceof Error ? error.message.slice(0, 300) : "send failed" }).eq("id", row.id);
    return "failed" as const;
  }
}

/** Rows a past run claimed but could not send (e.g. Gmail login rejected) go back in the queue. */
export async function requeueFailedSends(client: Client) {
  const { data } = await client.from(TABLE).update({ status: "ready", emailed_at: null })
    .eq("status", "emailed").is("followup_at", null).like("last_error", "SMTP%").select("id");
  return data?.length ?? 0;
}

/** Runs one outreach cycle and records the outcome in chillbros_leadbiz_runs. */
export async function runLeadbizOutreach(client: Client, now = new Date()): Promise<LeadbizRun> {
  let result: LeadbizRun;
  try { result = await runCycle(client, now); }
  catch (error) {
    await client.from("chillbros_leadbiz_runs").insert({ result: { error: error instanceof Error ? error.message : "run failed" } });
    throw error;
  }
  await client.from("chillbros_leadbiz_runs").insert({ result });
  return result;
}

async function runCycle(client: Client, now: Date): Promise<LeadbizRun> {
  const run: LeadbizRun = { enabled: process.env.LEADBIZ_OUTREACH_ENABLED === "1", discovered: 0, enriched: 0, sent: 0, followedUp: 0, failed: 0 };
  const deadline = Date.now() + 240_000;
  try { run.licenses = (await refreshContractors(client, now)) ?? undefined; }
  catch (error) { run.licenses = error instanceof Error ? error.message.slice(0, 200) : "license refresh failed"; }
  // Discovery and enrichment are read-only research and run even while sending is off.
  const { count: queued } = await client.from(TABLE).select("id", { count: "exact", head: true }).in("status", ["new", "ready"]);
  if ((queued ?? 0) < 40) {
    if (process.env.GOOGLE_PLACES_API_KEY) {
      const googleDeadline = Math.min(deadline, Date.now() + 120_000);
      for (let slot = 0; slot < GOOGLE_SEARCHES_PER_RUN && Date.now() < googleDeadline - 20_000; slot++) {
        try { run.discovered += await discoverBuyersGoogle(client, googleDeadline, run, slot); }
        catch (error) { run.note = error instanceof Error ? error.message : "google discovery failed"; break; }
      }
    } else {
      try { run.discovered = await discoverBuyers(client, Math.min(deadline, Date.now() + 90_000), run); }
      catch (error) { run.note = error instanceof Error ? error.message : "discovery failed"; }
      if (!run.discovered) run.note = `${run.note ?? "free map found no new contractors"}; set GOOGLE_PLACES_API_KEY for real coverage`;
    }
  }
  run.enriched = await enrichBuyers(client, 20, Math.min(deadline, Date.now() + 120_000));

  const sender = account();
  if (!run.enabled) return { ...run, note: run.note ?? "Sending is off (LEADBIZ_OUTREACH_ENABLED is not 1)." };
  if (!sender) return { ...run, note: "Sender not configured (LEADBIZ_SMTP_USER / LEADBIZ_SMTP_APP_PASSWORD)." };
  if (!inSendWindow(now)) return { ...run, note: "Outside the 9am–5pm Central send window." };

  await requeueFailedSends(client);
  const cap = Math.min(envCap(), rampCap(await firstSentAt(client), now));
  let budget = Math.min(perRunFor(cap), cap - (await sentToday(client, now)));
  if (budget <= 0) return { ...run, note: "Daily cap reached." };

  const due = new Date(now.getTime() - FOLLOW_UP_DAYS * 86400_000).toISOString();
  const { data: followUps } = await client.from(TABLE).select("id,business_name,trade,email").eq("status", "emailed").is("followup_at", null).lte("emailed_at", due).not("email", "is", null).limit(budget);
  for (const row of followUps ?? []) {
    if (budget <= 0 || Date.now() > deadline) break;
    const r = await sendOne(client, row, true, sender);
    if (r === "sent") { run.followedUp++; budget--; } else if (r === "failed") { run.failed++; return { ...run, note: "Send failed; stopped this run (see last_error)." }; }
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
    if (r === "sent") { run.sent++; budget--; } else if (r === "failed") { run.failed++; return { ...run, note: "Send failed; stopped this run (see last_error)." }; }
  }
  return run;
}
