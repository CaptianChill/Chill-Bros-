// Lead business ("San Antonio New Openings"): pure rules for finding contractor buyers and
// writing the offer email. No I/O here so it is unit-tested (scripts/leadbiz.test.cjs).
import type { Trade } from "../trade-fit";

export const LEADBIZ_BRAND = "San Antonio New Openings";
export const LEADBIZ_PHONE = "(210) 904-9306";
export const LEADBIZ_POSTAL = "Chill Professionals LLC, 15226 Preston Pass, San Antonio, TX 78247";
export const PAY_LINKS = {
  openings: "https://square.link/u/RStoSpmq",
  bundle: "https://square.link/u/6Cdb25fY",
  starter: "https://square.link/u/DMHFLgWQ",
} as const;

// San Antonio metro (Boerne/New Braunfels/Schertz edges to Lackland/Southside).
export const SA_BBOX = "(29.20,-98.80,29.75,-98.20)";

export const TRADE_LABEL: Record<Trade, { plural: string; hook: string }> = {
  plumbing: { plural: "plumbers", hook: "rough-in, grease traps and backflow before opening day" },
  electrical: { plural: "electricians", hook: "panels, kitchen circuits and lighting before inspection" },
  hood_cleaning: { plural: "hood cleaning companies", hook: "a hood system cleaned and certified for the fire inspection" },
  pest_control: { plural: "pest control companies", hook: "a pre-opening pest program for the health inspection" },
  commercial_cleaning: { plural: "commercial cleaning companies", hook: "post-construction cleanup and a nightly cleaning contract" },
  signs: { plural: "sign companies", hook: "storefront and pylon signage before opening day" },
  low_voltage: { plural: "low voltage contractors", hook: "POS, network, music and camera cabling before the walls close" },
  security: { plural: "security companies", hook: "cameras, alarm and access control before they stock the place" },
};

const RULES: [Trade, RegExp][] = [
  ["hood_cleaning", /\b(hood|exhaust)\s*(and|&)?\s*(duct\s*)?clean|kitchen\s+exhaust/i],
  ["plumbing", /plumb|\bdrain\b|rooter|sewer/i],
  ["pest_control", /\bpest\b|termite|extermin|bug\s*(man|guy)/i],
  ["low_voltage", /low[\s-]?voltage|cabling|\bdata\s+(cable|wiring)|audio[\s-]?visual|\bav\s+(systems|solutions|integration)/i],
  ["security", /security\s+(systems?|solutions|services|integrat)|\balarm|surveillance|access\s+control/i],
  ["commercial_cleaning", /janitor|custodial|commercial\s+clean|office\s+clean|cleaning\s+(services?|co|company|solutions)/i],
  ["signs", /\bsigns?\b|signage|sign\s+co/i],
  ["electrical", /electric(al|ian|s)?\b/i],
];
const NOT_A_CONTRACTOR = /dry\s*clean|car\s*wash|carpet\s+one|supply|wholesale|depot|store|bank|social security|church|school|college|university|hospital|restaurant/i;
const CRAFT: Record<string, Trade> = { plumber: "plumbing", electrician: "electrical", signmaker: "signs", pest_control: "pest_control", cleaning: "commercial_cleaning" };

/** Which buyer trade a mapped business is, or null if it isn't one of the 8 contractor trades. */
export function classifyBuyer(tags: Record<string, string>): Trade | null {
  const name = String(tags.name ?? "").trim();
  if (!name || NOT_A_CONTRACTOR.test(name)) return null;
  if (tags.amenity) return null;
  if (tags.craft && CRAFT[tags.craft]) return CRAFT[tags.craft];
  if (tags.shop === "security") return "security";
  if (tags.shop === "pest_control") return "pest_control";
  for (const [trade, re] of RULES) if (re.test(name)) return trade;
  return null;
}

export function buyerQuery(bbox = SA_BBOX) {
  return `
[out:json][timeout:25];
(
  nwr["craft"~"^(plumber|electrician|signmaker|pest_control|cleaning)$"]${bbox};
  nwr["shop"~"^(security|pest_control)$"]${bbox};
  nwr["office"]["name"~"plumb|electric|hood|exhaust|pest|termite|extermin|janitor|custodial|cleaning|signs|signage|cabling|low voltage|audio visual|security|alarm",i]${bbox};
  nwr["name"~"plumb|electric|janitor|custodial|pest control|termite|signs|signage|cabling|low voltage|alarm|security systems|hood clean|exhaust clean",i]["website"]${bbox};
);
out tags center 2000;
`;
}

export type BuyerRow = { business_name: string; trade: Trade; email: string | null; phone: string | null; website: string | null; address: string | null; source_url: string };

export function buyerFromElement(el: { type: string; id: number; tags?: Record<string, string> }): BuyerRow | null {
  const tags = el.tags ?? {};
  const trade = classifyBuyer(tags);
  if (!trade) return null;
  const email = String(tags.email ?? tags["contact:email"] ?? "").trim().toLowerCase() || null;
  const website = String(tags.website ?? tags["contact:website"] ?? "").trim() || null;
  const phone = String(tags.phone ?? tags["contact:phone"] ?? "").trim() || null;
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const address = [street, tags["addr:city"]].filter(Boolean).join(", ") || null;
  return {
    business_name: String(tags.name).slice(0, 200), trade,
    email: email && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) ? email : null,
    phone, website: website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null,
    address, source_url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  };
}

/** Central-time sending window: weekdays 9:00–2:59pm (business hours when contractor owners read email). */
export function inSendWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", hour12: false }).formatToParts(now);
  const day = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
  return !["Sat", "Sun"].includes(day) && hour >= 9 && hour <= 14;
}

export function offerEmail(b: { business_name: string; trade: Trade }, unsubscribeUrl: string, followUp = false) {
  const t = TRADE_LABEL[b.trade];
  const subject = followUp
    ? `Re: new San Antonio commercial projects for ${t.plural}`
    : `16 new San Antonio commercial projects for ${t.plural}`;
  const opener = followUp
    ? `Quick follow-up on the new commercial projects list. The founding rate is only open to the first few ${t.plural}, max 3 per trade.`
    : `I track new restaurant and retail build-outs across San Antonio from Texas state construction filings. Right now there are 16 active projects (new restaurants, grocery and quick-service openings), each with the owner or tenant contact and phone, and every one of them needs ${t.hook}.`;
  const text = [
    `Hi ${b.business_name} team,`,
    "",
    opener,
    "",
    `I'm offering packs to a few local ${t.plural} (max 3 per trade):`,
    `- New Openings Pack, 16 verified projects: $150 founding rate (normally $250)`,
    `  ${PAY_LINKS.openings}`,
    `- Founding Bundle, the 16 projects + 50 ready-to-call restaurants and markets, with call openers written for your trade: $199`,
    `  ${PAY_LINKS.bundle}`,
    `- Commercial Starter Pack, 50 ready-to-call businesses: $75`,
    `  ${PAY_LINKS.starter}`,
    "",
    "Delivered by email within 2 hours of checkout. Reply here with any questions.",
    "",
    `${LEADBIZ_BRAND}`,
    `${LEADBIZ_PHONE}`,
    LEADBIZ_POSTAL,
    "",
    `You're getting this business email because ${b.business_name} is listed as a San Antonio contractor. Not interested? Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");
  return { subject, text };
}
