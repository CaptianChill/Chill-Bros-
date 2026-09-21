// Deterministic Battle Card fields, derived only from data Revenue Radar already
// has for a lead (category, service_line, signal_summary, contact_*, source_url,
// verification_status, recorded revenue). Nothing here invents a name, phone,
// email, dollar figure, facility size, or equipment failure that is not already
// stored on the lead — sections that lack real data say "Research pending"
// instead of guessing.

export type BattleCardLead = {
  business_name: string;
  city: string;
  category: string;
  service_line: string;
  signal_summary: string;
  signal_verified: boolean;
  verification_status?: string | null;
  signal_observed_at: string;
  score: number;
  status: string;
  business_address?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  source_url: string;
  estimated_revenue?: number | string | null;
  actual_revenue?: number | string | null;
  follow_up_at?: string | null;
};

export type OpportunityKind = "one_time" | "recurring" | "mixed" | "unknown";

export type BattleCard = {
  isGeneric: boolean;
  leadKindLabel: string;
  businessSummary: string;
  decisionMaker: { name: string; role: string | null; phone: string | null; email: string | null } | null;
  whyNow: string;
  evidence: string[];
  recommendedOffer: string;
  opportunityKind: OpportunityKind;
  opportunitySummary: string;
  nextAction: string;
};

const SERVICE_OFFER: Record<string, string> = {
  hvac_r: "Chill Bros commercial HVAC/R service introduction and preventive-maintenance proposal",
  refrigeration: "Chill Bros commercial refrigeration service and preventive-maintenance proposal",
  ice_machine: "Chill Bros ice-machine service and maintenance proposal",
  kitchen_equipment: "Chill Bros commercial kitchen equipment service proposal",
  exhaust_hood: "Chill Bros exhaust hood and ventilation service proposal",
  multiple: "Chill Bros multi-line proposal covering HVAC/R, refrigeration, ice, and kitchen equipment",
};

const CATEGORY_OFFER_SUFFIX: Record<string, string> = {
  opening_remodel: ", positioned for new-construction commissioning and startup service",
  equipment_failure: ", positioned as an urgent service call",
  property_manager: ", positioned as a multi-site service agreement",
  supplier_referral: "",
  other: " — qualify the need before proposing a specific offer",
};

const CATEGORY_WHY_NOW: Record<string, string> = {
  opening_remodel: "A new construction or remodel project is underway. This is the best window to secure the account before another vendor does.",
  equipment_failure: "A documented equipment or inspection issue signals an active, near-term service need.",
  property_manager: "A property/facilities management signal suggests there is an active decision-maker for vendor selection.",
  supplier_referral: "A supplier or partner referral signals a buying conversation may already be underway.",
  other: "This is an automatically discovered business match with no documented trigger yet. Research pending before treating it as high-intent.",
};

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, ms / 86400000);
}

function money(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The automated OpenStreetMap scanner always writes category "other" with
 * signal_verified=false and a fixed boilerplate summary (see
 * lib/chillbros/revenue-discovery.ts). Anything matching that shape is a
 * generic discovery lead, not a documented high-intent signal, regardless of
 * its numeric score.
 */
export function isGenericDiscoveryLead(lead: Pick<BattleCardLead, "category" | "signal_verified" | "verification_status">): boolean {
  return lead.category === "other" && !lead.signal_verified && lead.verification_status !== "source_verified";
}

export function buildBattleCard(lead: BattleCardLead): BattleCard {
  const generic = isGenericDiscoveryLead(lead);
  const service = SERVICE_OFFER[lead.service_line] ?? "Chill Bros commercial service proposal";
  const offerSuffix = CATEGORY_OFFER_SUFFIX[lead.category] ?? "";

  const businessSummary = generic
    ? `${lead.business_name} — automatically discovered ${lead.service_line.replaceAll("_", " ")} prospect in ${lead.city}. Full business profile not yet researched.`
    : lead.signal_summary || "Research pending.";

  const decisionMaker = lead.contact_name || lead.contact_phone || lead.contact_email
    ? {
        name: lead.contact_name || "Name not yet confirmed — contact info on file",
        role: lead.contact_role || null,
        phone: lead.contact_phone || null,
        email: lead.contact_email || null,
      }
    : null;

  const evidence: string[] = [];
  if (lead.source_url) evidence.push(`Source: ${lead.source_url}`);
  evidence.push(`Signal observed ${new Date(lead.signal_observed_at).toLocaleDateString()}`);
  evidence.push(
    lead.signal_verified
      ? "Directly verified signal"
      : lead.verification_status === "source_verified"
        ? "Source-verified public record"
        : generic
          ? "Unverified automated business-listing match only"
          : "Unverified public signal — confirm before outreach",
  );
  if (lead.business_address) evidence.push(`Address on file: ${lead.business_address}`);

  const recommendedOffer = generic ? `${service} — needs qualification before an offer can be proposed.` : `${service}${offerSuffix}.`;

  let opportunityKind: OpportunityKind = "unknown";
  let opportunitySummary = "Not yet estimated — confirm need before estimating opportunity.";
  if (!generic) {
    if (lead.category === "opening_remodel") {
      opportunityKind = "mixed";
      opportunitySummary = "ONE-TIME: new-construction commissioning/startup service. RECURRING: ongoing preventive-maintenance contract once the location opens.";
    } else if (lead.category === "equipment_failure") {
      opportunityKind = "mixed";
      opportunitySummary = "ONE-TIME: repair/service call for the documented issue. RECURRING: preventive-maintenance contract to help prevent recurrence.";
    } else if (lead.category === "property_manager") {
      opportunityKind = "recurring";
      opportunitySummary = "RECURRING: multi-site or ongoing facilities service agreement potential.";
    } else if (lead.category === "supplier_referral") {
      opportunityKind = "unknown";
      opportunitySummary = "Opportunity type not yet confirmed — qualify with the referral source.";
    }
  }
  const recordedRevenue = money(lead.actual_revenue) ?? money(lead.estimated_revenue);
  if (recordedRevenue !== null) {
    const label = money(lead.actual_revenue) !== null ? "Recorded revenue" : "Recorded estimate";
    opportunitySummary += ` ${label} on file: $${recordedRevenue.toLocaleString()}.`;
  }

  let nextAction: string;
  if (generic) {
    nextAction = "Research and verify this business before contacting — confirm it is a real, current, active commercial account and identify the right contact.";
  } else if (lead.follow_up_at && new Date(lead.follow_up_at).getTime() > Date.now()) {
    nextAction = `Follow up on the scheduled date (${new Date(lead.follow_up_at).toLocaleDateString()}).`;
  } else if (lead.contact_name && (decisionMaker?.phone || decisionMaker?.email)) {
    nextAction = `Call or email ${lead.contact_name} to introduce Chill Bros and confirm the project timeline.`;
  } else if (decisionMaker?.phone || decisionMaker?.email) {
    nextAction = "Call the number or email on file to introduce Chill Bros and identify the decision-maker.";
  } else {
    nextAction = "Research the facilities or operations decision-maker, then call to introduce Chill Bros.";
  }

  return {
    isGeneric: generic,
    leadKindLabel: generic ? "Generic discovery lead" : "Verified high-intent lead",
    businessSummary,
    decisionMaker,
    whyNow: CATEGORY_WHY_NOW[lead.category] ?? CATEGORY_WHY_NOW.other,
    evidence,
    recommendedOffer,
    opportunityKind,
    opportunitySummary,
    nextAction,
  };
}

export function urgencyScore(lead: Pick<BattleCardLead, "score" | "signal_observed_at">): number {
  const days = daysSince(lead.signal_observed_at);
  const recencyBoost = days <= 3 ? 20 : days <= 7 ? 12 : days <= 30 ? 4 : 0;
  return Number(lead.score) + recencyBoost;
}
