export const salesLeadStatuses = [
  "new",
  "ready_to_call",
  "contacted",
  "qualified",
  "technician_needed",
  "appointment_set",
  "proposal_requested",
  "won",
  "lost",
  "nurture",
  "do_not_contact",
] as const;

export type SalesLeadStatus = (typeof salesLeadStatuses)[number];

export const BATTLE_CARD_PROMPT_VERSION = "revenue-radar-sales-v1";

export type LeadRankingInput = {
  score: number;
  category: string;
  serviceLine: string;
  signalSummary: string;
  signalVerified: boolean;
  verificationStatus?: string | null;
  observedAt: string;
  businessAddress?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
};

export function explainLeadRanking(input: LeadRankingInput): string[] {
  const reasons: string[] = [];
  const ageDays = Math.max(0, (Date.now() - new Date(input.observedAt).getTime()) / 86400000);

  if (input.score >= 90) reasons.push(`Top-tier Revenue Radar priority at ${input.score}/100.`);
  else if (input.score >= 75) reasons.push(`High-priority Revenue Radar score at ${input.score}/100.`);
  else reasons.push(`Revenue Radar score: ${input.score}/100.`);

  if (input.category === "opening_remodel") reasons.push("Active opening or remodel creates a time-sensitive vendor opportunity.");
  if (input.category === "equipment_failure") reasons.push("Reported equipment-failure signal can indicate immediate service demand, subject to customer confirmation.");
  if (input.category === "property_manager") reasons.push("Property/facilities signal can lead to recurring multi-site service work.");
  if (input.serviceLine === "multiple") reasons.push("One account fits multiple Chill Pros service lines, increasing account value.");

  const summary = input.signalSummary.toLowerCase();
  if (/room|hotel|resort|square[- ]foot|sq\.? ?ft|grocery|restaurant|multiple|four distinct|food-and-beverage|food and beverage/.test(summary)) {
    reasons.push("Public information indicates a substantial commercial equipment footprint.");
  }

  if (input.signalVerified || input.verificationStatus === "source_verified") reasons.push("The lead signal is backed by a verified public source.");
  if (ageDays <= 14) reasons.push("The opportunity signal is recent, improving timing for outreach.");
  if (input.contactPhone || input.contactEmail) reasons.push("Reachable phone or email information is already available.");
  if (input.contactName) reasons.push("A lead contact or contact role is already identified.");
  if (input.businessAddress) reasons.push("The service location is identified.");

  return reasons;
}

export type BattleCardInput = {
  businessName: string;
  city: string;
  businessType?: string | null;
  score: number;
  serviceLine: string;
  signalSummary: string;
  signalVerified: boolean;
  sourceUrl: string;
  observedAt: string;
  businessAddress?: string | null;
  contactName?: string | null;
  contactRole?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
};

export type SalesBattleCard = {
  verifiedFacts: string[];
  reasonableInferences: string[];
  missingInformation: string[];
  whyNow: string;
  primaryContactRole: string;
  backupContactRoles: string[];
  serviceAngle: string;
  callOpener: string;
  discoveryQuestions: string[];
  buyingSignals: string[];
  objectionResponses: Array<{ objection: string; response: string }>;
  bestNextStep: string;
  technicalHandoff: string;
  followUpPlan: string;
};

const serviceLabel = (line: string) => ({
  hvac_r: "commercial HVAC/R",
  refrigeration: "commercial refrigeration",
  ice_machine: "ice-machine service",
  kitchen_equipment: "commercial kitchen equipment",
  exhaust_hood: "kitchen exhaust and hood service",
  multiple: "commercial HVAC/R, refrigeration, ice, and kitchen equipment",
}[line] ?? "commercial equipment service");

export function buildSafeBattleCard(input: BattleCardInput): SalesBattleCard {
  const service = serviceLabel(input.serviceLine);
  const verifiedFacts = [
    `Business: ${input.businessName}`,
    `Location: ${input.businessAddress || input.city}`,
    `Revenue Radar score: ${input.score}/100`,
    `Public signal: ${input.signalSummary}`,
    `Signal observed: ${new Date(input.observedAt).toLocaleDateString()}`,
    `Source: ${input.sourceUrl}`,
  ];
  if (input.contactName) verifiedFacts.push(`Known contact: ${input.contactName}${input.contactRole ? ` — ${input.contactRole}` : ""}`);
  if (input.contactPhone) verifiedFacts.push(`Known phone: ${input.contactPhone}`);
  if (input.contactEmail) verifiedFacts.push(`Known email: ${input.contactEmail}`);

  const reasonableInferences = [
    `The business may have recurring need for ${service}; confirm this with the customer before treating it as a need.`,
    "A facilities, operations, general-management, ownership, or maintenance role is likely to influence service-vendor decisions; verify the correct role.",
  ];

  const missingInformation = [
    ...(input.contactName ? [] : ["Decision-maker name"]),
    ...(input.contactRole ? [] : ["Decision-maker role"]),
    ...(input.contactPhone ? [] : ["Direct phone"]),
    ...(input.contactEmail ? [] : ["Direct email"]),
    "Current service provider",
    "Preventive-maintenance status",
    "Confirmed equipment inventory",
    "Any customer-confirmed service problem",
  ];

  return {
    verifiedFacts,
    reasonableInferences,
    missingInformation,
    whyNow: input.signalVerified
      ? "Revenue Radar has a directly verified signal. Confirm the current situation and identify the correct next step."
      : "Revenue Radar found a public commercial signal. Use it only as context for a timely introduction; do not imply Chill Pros knows equipment is failing.",
    primaryContactRole: input.contactRole || "Facilities / Operations Manager",
    backupContactRoles: ["General Manager", "Owner / Property Manager"],
    serviceAngle: `Introduce Chill Pros as a local ${service} resource and determine who manages service, emergency response, and preventive maintenance.`,
    callOpener: `Hi, this is [NAME] with Chill Pros. We handle ${service} around San Antonio. I came across ${input.businessName} while reviewing commercial service opportunities in the area. Who is the best person to speak with about your equipment service and preventive maintenance?`,
    discoveryQuestions: [
      "Who currently handles your HVAC and refrigeration service?",
      "Do you use one service company or several vendors?",
      "Do you have preventive maintenance in place?",
      "Who handles emergency equipment calls?",
      "Are you satisfied with your current response times?",
      "Is there any equipment giving you trouble right now?",
    ],
    buyingSignals: [
      "We do not have anybody.",
      "Our current company takes too long.",
      "That unit keeps going down.",
      "We need another vendor.",
      "We need bids or preventive maintenance.",
      "Speak with our facilities manager.",
    ],
    objectionResponses: [
      { objection: "We already have a company.", response: "Understood. Do you keep a secondary vendor for overflow or emergency calls?" },
      { objection: "Send me information.", response: "Absolutely. What is the best email, and who should I address it to?" },
      { objection: "Corporate handles that.", response: "Got it. What department or contact handles approved service vendors?" },
      { objection: "We do not need anything.", response: "Understood. I can leave our information as a backup resource and follow up later if that is useful." },
      { objection: "How much do you charge?", response: "Pricing depends on the equipment and scope. I can get the right information to our service team so we do not guess at your situation." },
    ],
    bestNextStep: "Identify the decision maker and secure one concrete next action: service call, walkthrough, facilities conversation, vendor-registration step, or scheduled follow-up.",
    technicalHandoff: "Do not diagnose. Capture the equipment type, customer's exact symptoms, operating status, business impact, urgency, and best contact. Tell the customer: “I don't want to guess at the technical side. I'll get this information to our service team so the right person can review it with you.”",
    followUpPlan: "Record the outcome immediately. If the opportunity remains open, set a dated follow-up task with one owner and one specific purpose.",
  };
}
