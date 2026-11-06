// Buyer trades for the lead business. Revenue Radar leads are sold to contractors in
// these trades, so every lead is tagged with the trades it fits (trade_fits column,
// filled by a database trigger on insert; see migration 20261105170000).
export const TRADES = {
  plumbing: "Plumbers",
  electrical: "Electricians",
  hood_cleaning: "Hood cleaners",
  pest_control: "Pest control",
  commercial_cleaning: "Commercial cleaning",
  signs: "Signs",
  low_voltage: "Low voltage",
  security: "Security",
} as const;
export type Trade = keyof typeof TRADES;
export const TRADE_KEYS = Object.keys(TRADES) as Trade[];
export const isTrade = (v: unknown): v is Trade => typeof v === "string" && v in TRADES;

// Kitchens with cooking lines need hood cleaning; every commercial site needs the rest.
const COOKING_LINES = new Set(["multiple", "kitchen_equipment", "exhaust_hood"]);

// Mirrors the SQL in chillbros_revenue_trade_fits() so tests and the database agree.
export function tradeFitsFor(lead: { category?: string | null; service_line?: string | null }): Trade[] {
  if (lead.category === "opening_remodel" || COOKING_LINES.has(lead.service_line ?? "")) return [...TRADE_KEYS];
  return TRADE_KEYS.filter((t) => t !== "hood_cleaning");
}

// What each trade opens a cold call with, by lead type. A new build-out is the
// strongest hook for every trade; existing sites get a recurring-service angle.
const OPENING_HOOK: Record<Trade, string> = {
  plumbing: "rough-in, grease trap and backflow setup before you open",
  electrical: "panel, kitchen circuits and lighting before inspection",
  hood_cleaning: "getting the hood system cleaned and certified for your fire inspection",
  pest_control: "a pre-opening pest program so the health inspection goes clean",
  commercial_cleaning: "post-construction cleanup and a nightly cleaning schedule",
  signs: "your storefront and pylon signage so customers find you on day one",
  low_voltage: "POS, network, music and camera cabling before the walls close",
  security: "cameras, alarm and access control before you stock the place",
};
// Auto openings (car washes, oil change, collision, dealership service shops): no kitchens.
const AUTO_HOOK: Record<Trade, string> = {
  plumbing: "water reclaim, oil-water separators and shop plumbing",
  electrical: "lifts, compressors, bay lighting and EV chargers",
  hood_cleaning: "shop exhaust and ventilation cleaning",
  pest_control: "pest service for the shop and customer waiting area",
  commercial_cleaning: "post-construction cleanup and shop floor and lobby cleaning",
  signs: "pylon and bay signage so drivers find you on day one",
  low_voltage: "POS, network, music and camera cabling before the walls close",
  security: "cameras, alarm and access control for the bays and the lot",
};
const EXISTING_HOOK: Record<Trade, string> = {
  plumbing: "grease trap service and emergency plumbing coverage",
  electrical: "repairs, lighting upgrades and backup for kitchen circuits",
  hood_cleaning: "scheduled hood and exhaust cleaning to stay fire-code compliant",
  pest_control: "monthly pest service that keeps you clear on health inspections",
  commercial_cleaning: "nightly or weekly cleaning so your staff can focus on service",
  signs: "sign repair, relighting and refresh",
  low_voltage: "network, POS and camera cabling fixes and upgrades",
  security: "camera, alarm and access-control upgrades",
};

export function tradeOpener(trade: Trade, lead: { business_name: string; category?: string | null; industry?: string | null }) {
  const opening = lead.category === "opening_remodel";
  const hook = opening ? (lead.industry === "auto" ? AUTO_HOOK : OPENING_HOOK)[trade] : EXISTING_HOOK[trade];
  return opening
    ? `Hi, I saw ${lead.business_name} has a build-out on file with the state. Who's handling ${hook}? We do that locally and can get you a quote this week.`
    : `Hi, I work with businesses like ${lead.business_name} on ${hook}. Who handles that for you now, and when did they last come out?`;
}
