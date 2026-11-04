import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPage } from "@/lib/chillbros/autopilot/engine";
import { contactPageUrls, phoneFromHtml } from "@/lib/chillbros/autopilot/contact-source";
import { pickBusinessEmail } from "@/lib/chillbros/autopilot/email-extract";
import { AI_BATTLE_CARD_PROMPT_VERSION, writeAiBattleCard, type AiBattleCard } from "@/lib/chillbros/revenue-ai";
import { BATTLE_CARD_PROMPT_VERSION, buildSafeBattleCard, type BattleCardInput } from "@/lib/chillbros/revenue-sales";
import { nextSalesStatus, placesQuery, sameBusiness, wantsAiCard, PREP_CLOSED_STATUSES } from "@/lib/chillbros/sales-prep-logic";

// Sales Prep: works through every open Revenue Radar lead and makes it ready to sell.
//  1. Contact: leads with no phone and no email get a Google Places lookup (when
//     GOOGLE_PLACES_API_KEY is set) for phone + website, then the website is checked for an email.
//  2. Battle card: reachable leads get the AI card (call opener, questions, objections,
//     plan tier, intro email draft); unreachable leads get the free standard card.
//  3. Status: fresh leads with a way to reach them move to ready_to_call.
// Nothing here sends anything. The email is a draft saved on the lead.

type Client = SupabaseClient;
const AI_TRIGGER = "sales_prep";
const LEAD_COLUMNS = "id,business_name,city,category,score,service_line,signal_summary,signal_verified,source_url,signal_observed_at,business_address,contact_name,contact_role,contact_phone,contact_email,sales_status,do_not_contact,places_checked_at";

type Lead = {
  id: string; business_name: string; city: string; category: string | null; score: number; service_line: string;
  signal_summary: string; signal_verified: boolean; source_url: string; signal_observed_at: string;
  business_address: string | null; contact_name: string | null; contact_role: string | null;
  contact_phone: string | null; contact_email: string | null; sales_status: string | null; do_not_contact: boolean;
  places_checked_at: string | null;
};

export type SalesPrepRun = { contactsLooked: number; contactsFound: number; aiCards: number; standardCards: number; readied: number; remaining: number; googleKey: boolean; errors: number };

async function lookupPlace(apiKey: string, lead: Lead) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey, "x-goog-fieldmask": "places.displayName,places.nationalPhoneNumber,places.websiteUri,places.businessStatus" },
    body: JSON.stringify({ textQuery: placesQuery(lead.business_name, lead.business_address, lead.city), pageSize: 1 }),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Google Places returned ${response.status}`);
  const payload = (await response.json()) as { places?: { displayName?: { text?: string }; nationalPhoneNumber?: string; websiteUri?: string; businessStatus?: string }[] };
  const place = payload.places?.[0];
  if (!place?.displayName?.text || !sameBusiness(lead.business_name, place.displayName.text)) return null;
  return { phone: place.nationalPhoneNumber ?? null, website: place.websiteUri ?? null, closed: Boolean(place.businessStatus && place.businessStatus !== "OPERATIONAL") };
}

async function emailFromSite(site: string) {
  const home = await fetchPage(site);
  let email = pickBusinessEmail(home, site);
  let phone = phoneFromHtml(home);
  if (!email) {
    for (const url of contactPageUrls(home, site)) {
      const page = await fetchPage(url);
      phone ||= phoneFromHtml(page);
      email = pickBusinessEmail(page, site);
      if (email) break;
    }
  }
  return { email, phone };
}

function cardInput(lead: Lead): BattleCardInput & { category?: string | null } {
  return {
    category: lead.category, businessName: lead.business_name, city: lead.city, businessType: lead.category,
    score: Number(lead.score), serviceLine: lead.service_line, signalSummary: lead.signal_summary,
    signalVerified: Boolean(lead.signal_verified), sourceUrl: lead.source_url, observedAt: lead.signal_observed_at,
    businessAddress: lead.business_address, contactName: lead.contact_name, contactRole: lead.contact_role,
    contactPhone: lead.contact_phone, contactEmail: lead.contact_email,
  };
}

async function saveCard(client: Client, lead: Lead, content: unknown, version: string) {
  const { data: previous } = await client.from("chillbros_revenue_battle_cards").select("id").eq("lead_id", lead.id).eq("is_current", true).maybeSingle();
  const { data: created, error } = await client.from("chillbros_revenue_battle_cards")
    .insert({ lead_id: lead.id, content, prompt_version: version, generation_trigger: AI_TRIGGER, generated_by: null, is_current: false })
    .select("id").single();
  if (error) throw new Error(error.message);
  const now = new Date().toISOString();
  if (previous) await client.from("chillbros_revenue_battle_cards").update({ is_current: false, superseded_at: now }).eq("id", previous.id);
  const { error: promote } = await client.from("chillbros_revenue_battle_cards").update({ is_current: true }).eq("id", created.id);
  if (promote) {
    if (previous) await client.from("chillbros_revenue_battle_cards").update({ is_current: true, superseded_at: null }).eq("id", previous.id);
    throw new Error(promote.message);
  }
}

// Leads still needing prep: open, and either no current card, or only a standard card while now reachable.
async function prepQueue(client: Client, limits: { ai: number; standard: number }, googleKey: boolean) {
  const { data: cards, error: cardError } = await client.from("chillbros_revenue_battle_cards").select("lead_id,prompt_version").eq("is_current", true);
  if (cardError) throw new Error(cardError.message);
  const cardVersion = new Map((cards ?? []).map((c) => [c.lead_id as string, c.prompt_version as string]));
  const leads: Lead[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from("chillbros_revenue_prospects").select(LEAD_COLUMNS)
      .eq("do_not_contact", false).not("sales_status", "in", `(${PREP_CLOSED_STATUSES.join(",")})`)
      .order("score", { ascending: false }).order("id", { ascending: true }).range(from, from + 999);
    if (error) throw new Error(error.message);
    leads.push(...((data ?? []) as Lead[]));
    if (!data || data.length < 1000) break;
  }
  const pending = leads.filter((l) => {
    const v = cardVersion.get(l.id);
    if (!v) return true;
    if (v !== AI_BATTLE_CARD_PROMPT_VERSION && wantsAiCard(l)) return true;
    // Unreachable leads come back once for a Places lookup when a key is available.
    return googleKey && !l.places_checked_at && !wantsAiCard(l);
  });
  // Mix the batch so the cheap standard cards are not stuck behind slower AI ones.
  const ai = pending.filter((l) => wantsAiCard(l)).slice(0, limits.ai);
  const rest = pending.filter((l) => !wantsAiCard(l)).slice(0, limits.standard);
  return { batch: [...ai, ...rest], remaining: pending.length };
}

export async function runSalesPrep(client: Client, opts: { aiLimit?: number; standardLimit?: number; deadlineMs?: number } = {}): Promise<SalesPrepRun> {
  const deadline = Date.now() + (opts.deadlineMs ?? 240_000);
  const googleKey = String(process.env.GOOGLE_PLACES_API_KEY || "").trim();
  const run: SalesPrepRun = { contactsLooked: 0, contactsFound: 0, aiCards: 0, standardCards: 0, readied: 0, remaining: 0, googleKey: Boolean(googleKey), errors: 0 };
  let aiBudget = opts.aiLimit ?? 24;
  let standardBudget = opts.standardLimit ?? 300;
  // With a Places key, unreachable leads cost a lookup each, so take fewer per run.
  const { batch, remaining } = await prepQueue(client, { ai: aiBudget, standard: googleKey ? 60 : standardBudget }, Boolean(googleKey));
  run.remaining = remaining;

  const queue = [...batch];
  const worker = async () => {
    while (queue.length && Date.now() < deadline - 20_000) {
      const lead = queue.shift()!;
      try {
        // 1. Contact info for leads with none.
        if (!lead.contact_phone && !lead.contact_email && googleKey && !lead.places_checked_at) {
          run.contactsLooked++;
          const place = await lookupPlace(googleKey, lead).catch((e) => { console.warn("[sales-prep] places lookup failed", e instanceof Error ? e.message : e); return null; });
          const found = place?.website ? await emailFromSite(place.website) : { email: null, phone: null };
          const phone = place?.phone || found.phone || null;
          const email = found.email || null;
          const update: Record<string, unknown> = { places_checked_at: new Date().toISOString() };
          if (phone) update.contact_phone = phone;
          if (email) update.contact_email = email;
          if (place?.closed) update.status_reason = "Google lists this business as closed";
          await client.from("chillbros_revenue_prospects").update(update).eq("id", lead.id);
          if (phone || email) { run.contactsFound++; lead.contact_phone = phone; lead.contact_email = email; }
        }

        // 2. Battle card.
        if (wantsAiCard(lead)) {
          if (aiBudget <= 0) continue;
          aiBudget--;
          const { card, aiUsed, error: aiError } = await writeAiBattleCard(cardInput(lead));
          if (!aiUsed) console.warn("[sales-prep] AI card fell back to standard", lead.id, aiError);
          await saveCard(client, lead, card, aiUsed ? AI_BATTLE_CARD_PROMPT_VERSION : BATTLE_CARD_PROMPT_VERSION);
          if (aiUsed) {
            run.aiCards++;
            const email = (card as AiBattleCard).introEmail;
            await client.from("chillbros_revenue_prospects").update({ email_subject: email.subject, email_draft: email.body }).eq("id", lead.id);
          } else run.standardCards++;
        } else {
          if (standardBudget <= 0) continue;
          standardBudget--;
          await saveCard(client, lead, buildSafeBattleCard(cardInput(lead)), BATTLE_CARD_PROMPT_VERSION);
          run.standardCards++;
        }

        // 3. Ready to call.
        const next = nextSalesStatus(lead);
        const now = new Date().toISOString();
        await client.from("chillbros_revenue_prospects").update({ ...(next ? { sales_status: next } : {}), ...(lead.contact_phone || lead.contact_email ? {} : { status_reason: "Needs phone or email before calling" }), updated_at: now }).eq("id", lead.id);
        if (next) run.readied++;
      } catch (e) {
        run.errors++;
        console.error("[sales-prep] lead failed", lead.id, e instanceof Error ? e.message : e);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return run;
}
