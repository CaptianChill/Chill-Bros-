import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPage } from "@/lib/chillbros/autopilot/engine";
import { contactPageUrls, phoneFromHtml } from "@/lib/chillbros/autopilot/contact-source";
import { pickBusinessEmail } from "@/lib/chillbros/autopilot/email-extract";
import { searchPlacesTransient } from "@/lib/chillbros/google-places";
import { AI_BATTLE_CARD_PROMPT_VERSION, writeAiBattleCard, type AiBattleCard } from "@/lib/chillbros/revenue-ai";
import { BATTLE_CARD_PROMPT_VERSION, buildSafeBattleCard, type BattleCardInput } from "@/lib/chillbros/revenue-sales";
import { nextSalesStatus, placesQuery, sameBusiness, wantsAiCard, PREP_CLOSED_STATUSES } from "@/lib/chillbros/sales-prep-logic";

// Sales Prep: works through every open Revenue Radar lead and makes it ready to sell.
//  1. Contact: leads with no phone and no email get a transient Google Places lookup (when
//     GOOGLE_PLACES_API_KEY is set) to find the business's own website; the phone and email
//     saved come only from that website, never from Google.
//  2. Battle card: reachable leads get the AI card (call opener, questions, objections,
//     plan tier, intro email draft); unreachable leads get the free standard card.
//  3. Status: fresh leads with a way to reach them move to ready_to_call.
// Nothing here sends anything. The email is a draft saved on the lead.

type Client = SupabaseClient;
const AI_TRIGGER = "sales_prep";
const LEAD_COLUMNS = "id,business_name,city,category,industry,score,service_line,signal_summary,signal_verified,source_url,signal_observed_at,business_address,contact_name,contact_role,contact_phone,contact_email,sales_status,do_not_contact,places_checked_at";

export type Lead = {
  id: string; business_name: string; city: string; category: string | null; industry?: string | null; score: number; service_line: string;
  signal_summary: string; signal_verified: boolean; source_url: string; signal_observed_at: string;
  business_address: string | null; contact_name: string | null; contact_role: string | null;
  contact_phone: string | null; contact_email: string | null; sales_status: string | null; do_not_contact: boolean;
  places_checked_at: string | null;
};

export type SalesPrepRun = { contactsLooked: number; contactsFound: number; aiCards: number; standardCards: number; readied: number; remaining: number; googleKey: boolean; errors: number };

// Google rule: transient lookup only. The Places result is used in memory just to find the
// business's own website (Google's name is only compared to make sure it's the same business).
// Google's phone, address, status, etc. are never saved (Maps Platform terms forbid storing
// Places content); we don't even request the phone. Only what the business's own website
// publishes is saved.
async function websiteFromPlaces(apiKey: string, lead: Lead) {
  const [place] = await searchPlacesTransient(apiKey, placesQuery(lead.business_name, lead.business_address, lead.city), { pageSize: 1 });
  if (!place || !place.operational || !sameBusiness(lead.business_name, place.name)) return null;
  return place.website;
}

/** The fields Sales Prep saves for a lead with no contact: only what the business's own site publishes. */
export async function contactUpdateFromPlaces(apiKey: string, lead: Lead): Promise<{ places_checked_at: string; contact_phone?: string; contact_email?: string }> {
  const website = await websiteFromPlaces(apiKey, lead).catch((e) => { console.warn("[sales-prep] places lookup failed", e instanceof Error ? e.message : e); return null; });
  const found = website ? await emailFromSite(website) : { email: null, phone: null };
  const update: { places_checked_at: string; contact_phone?: string; contact_email?: string } = { places_checked_at: new Date().toISOString() };
  if (found.phone) update.contact_phone = found.phone;
  if (found.email) update.contact_email = found.email;
  return update;
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
    contactPhone: lead.contact_phone, contactEmail: lead.contact_email, industry: lead.industry,
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
  // Read every current card: the API caps a request at 1,000 rows, and a missed card
  // made the job redo (and overwrite) leads that were already prepped.
  const cardVersion = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data: cards, error: cardError } = await client.from("chillbros_revenue_battle_cards").select("lead_id,prompt_version")
      .eq("is_current", true).order("id", { ascending: true }).range(from, from + 999);
    if (cardError) throw new Error(cardError.message);
    for (const c of cards ?? []) cardVersion.set(c.lead_id as string, c.prompt_version as string);
    if (!cards || cards.length < 1000) break;
  }
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
    // An older standard card is rebuilt with the current template.
    if (v !== AI_BATTLE_CARD_PROMPT_VERSION && v !== BATTLE_CARD_PROMPT_VERSION) return true;
    // Unreachable leads come back once for a Places lookup when a key is available.
    return googleKey && !l.places_checked_at && !wantsAiCard(l);
  });
  // Leads with no card at all go first (stable sort keeps score order): when AI cards fail
  // (e.g. the AI account is out of credits) the same top leads were retried every run and
  // new leads never got even a standard card.
  pending.sort((a, b) => Number(cardVersion.has(a.id)) - Number(cardVersion.has(b.id)));
  // Mix the batch so the cheap standard cards are not stuck behind slower AI ones.
  const ai = pending.filter((l) => wantsAiCard(l)).slice(0, limits.ai);
  const rest = pending.filter((l) => !wantsAiCard(l)).slice(0, limits.standard);
  return { batch: [...ai, ...rest], remaining: pending.length };
}

export async function runSalesPrep(client: Client, opts: { aiLimit?: number; standardLimit?: number; deadlineMs?: number } = {}): Promise<SalesPrepRun> {
  const deadline = Date.now() + (opts.deadlineMs ?? 240_000);
  const googleKey = String(process.env.GOOGLE_PLACES_API_KEY || "").trim();
  const run: SalesPrepRun = { contactsLooked: 0, contactsFound: 0, aiCards: 0, standardCards: 0, readied: 0, remaining: 0, googleKey: Boolean(googleKey), errors: 0 };
  let aiBudget = opts.aiLimit ?? 60;
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
          const update = await contactUpdateFromPlaces(googleKey, lead);
          const phone = update.contact_phone ?? null;
          const email = update.contact_email ?? null;
          await client.from("chillbros_revenue_prospects").update(update).eq("id", lead.id);
          if (phone || email) { run.contactsFound++; lead.contact_phone = phone; lead.contact_email = email; }
        }

        // 2. Battle card.
        // With the AI unavailable (out of credits) or its budget spent, every lead still gets a standard card.
        if (wantsAiCard(lead) && aiBudget > 0) {
          aiBudget--;
          const { card, aiUsed, error: aiError } = await writeAiBattleCard(cardInput(lead));
          if (!aiUsed) console.warn("[sales-prep] AI card fell back to standard", lead.id, aiError);
          // Out of AI credits: stop asking for the rest of this run instead of failing every card.
          if (!aiUsed && /credit|billing|quota|insufficient|rate limit/i.test(String(aiError))) { aiBudget = 0; run.errors++; }
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
