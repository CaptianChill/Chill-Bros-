// Lead business ("San Antonio New Openings"): pure rules for finding contractor buyers and
// writing the offer email. No I/O here so it is unit-tested (scripts/leadbiz.test.cjs).
import type { Trade } from "../trade-fit";

import { MAX_BUYERS_PER_TRADE, TRADE_SLUG } from "./catalog";

export const LEADBIZ_BRAND = "San Antonio New Openings";
export const LEADBIZ_PHONE = "(210) 904-9306";
export const LEADBIZ_QUOTE = "We work these job sites every week. We know which ones are worth the call.";
export const LEADBIZ_POSTAL = "Chill Professionals LLC, 15226 Preston Pass, San Antonio, TX 78247";
// Public terms page (absolute, for emails). chill-bros.vercel.app is the live host until
// chillprostx.com DNS points at Vercel (see docs/2026-09-21-session-log.md).
export const LEADBIZ_TERMS_URL = "https://chill-bros.vercel.app/new-openings/terms";
export const LEADBIZ_TERMS_EFFECTIVE = "November 6, 2026";
// Public sales page (2026-11-09): the San Antonio New Openings site, whose packs ask for availability
// before a Square invoice. The older /new-openings storefront on this app is no longer linked from
// scripts or emails.
export const LEADBIZ_SALES_URL = "https://san-antonio-new-openings.vercel.app";
export const salesLink = (trade: Trade) => `${LEADBIZ_SALES_URL}/?trade=${TRADE_SLUG[trade]}`;

// RETIRED Square links from the v1 lineup (all-projects packs + $449 exclusive). Not shown to
// buyers anymore; listed on the owner page so they can be turned off in Square. If one is paid
// anyway, the ledger still honors it (products legacy_* in chillbros_leadpack_products).
export const LEGACY_PAY_LINKS = {
  openings: "https://square.link/u/RStoSpmq",
  bundle: "https://square.link/u/6Cdb25fY",
  starter: "https://square.link/u/DMHFLgWQ",
  auto: "https://square.link/u/ju26cQ8a",
  food: "https://square.link/u/bTgyfEEO",
  exclusive: "https://square.link/u/ESlEYsen",
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
  hvac_refrigeration: { plural: "HVAC and refrigeration companies", hook: "rooftop units, walk-in coolers and ice machines installed and serviced" },
  kitchen_equipment: { plural: "commercial kitchen equipment companies", hook: "fryers, ovens, ranges and dish machines started up and serviced" },
};

const RULES: [Trade, RegExp][] = [
  ["kitchen_equipment", /(restaurant|kitchen|food\s*service|cooking)\s+equipment|appliance\s+repair/i],
  ["hvac_refrigeration", /\bhvac\b|air\s+condition|\ba\/?c\b|heating|refrigerat|cooling|mechanical/i],
  ["hood_cleaning", /\b(hood|exhaust)\s*(and|&)?\s*(duct\s*)?clean|kitchen\s+exhaust/i],
  ["plumbing", /plumb|\bdrain\b|rooter|sewer/i],
  ["pest_control", /\bpest\b|termite|extermin|bug\s*(man|guy)/i],
  ["low_voltage", /low[\s-]?voltage|cabling|\bdata\s+(cable|wiring)|audio[\s-]?visual|\bav\s+(systems|solutions|integration)/i],
  ["security", /security\s+(systems?|solutions|services|integrat)|\balarm|surveillance|access\s+control/i],
  ["commercial_cleaning", /janitor|custodial|commercial\s+clean|office\s+clean|cleaning\s+(services?|co|company|solutions)/i],
  ["signs", /\bsigns?\b|signage|sign\s+co/i],
  ["electrical", /electric(al|ian|s)?\b/i],
];
const NOT_A_CONTRACTOR = /dry\s*clean|car\s*wash|carpet\s+one|supply|wholesale|depot|store|bank|social security|church|school|college|university|hospital|restaurant(?!\s+equipment)/i;
const CRAFT: Record<string, Trade> = { hvac: "hvac_refrigeration", plumber: "plumbing", electrician: "electrical", signmaker: "signs", pest_control: "pest_control", cleaning: "commercial_cleaning" };

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

// Small, tag-indexed searches (the free map servers time out on one big name scan of the whole metro).
export function buyerQueries(bbox = SA_BBOX) {
  const q = (body: string) => `[out:json][timeout:15];(${body});out tags center 800;`;
  const names = "plumb|electric|hood|exhaust|pest|termite|extermin|janitor|custodial|cleaning|signs|signage|cabling|low voltage|audio visual|security|alarm";
  return [
    q(`nwr["craft"~"^(plumber|electrician|signmaker|pest_control|cleaning)$"]${bbox};`),
    q(`nwr["shop"~"^(security|pest_control|trade)$"]${bbox};nwr["craft"]["name"~"${names}",i]${bbox};`),
    q(`nwr["office"]["name"~"${names}",i]${bbox};`),
  ];
}

// Google Places searches per trade (the free map has almost no San Antonio contractors listed).
// Transient lookup only: see lib/chillbros/google-places.ts and buyerFromOwnSite below.
export const GOOGLE_TRADE_QUERIES: Record<Trade, string> = {
  plumbing: "commercial plumbing contractor",
  electrical: "commercial electrical contractor",
  hood_cleaning: "restaurant kitchen hood cleaning service",
  pest_control: "commercial pest control company",
  commercial_cleaning: "commercial janitorial cleaning company",
  signs: "commercial sign company",
  low_voltage: "low voltage structured cabling contractor",
  security: "commercial security camera and alarm installer",
  hvac_refrigeration: "commercial HVAC and refrigeration contractor",
  kitchen_equipment: "commercial kitchen equipment repair service",
};

/** Which (trade, area index) a run searches: rotates through every pair, one per run. */
export function googleRotation(runIndex: number, areaCount: number, trades = Object.keys(GOOGLE_TRADE_QUERIES) as Trade[]) {
  const i = ((runIndex % (trades.length * areaCount)) + trades.length * areaCount) % (trades.length * areaCount);
  return { trade: trades[i % trades.length], area: Math.floor(i / trades.length) };
}

/** False for stores, suppliers, schools and other names that aren't contractor buyers. */
export const isContractorName = (name: string) => Boolean(name.trim()) && !NOT_A_CONTRACTOR.test(name);

const decodeEntities = (s: string) => s
  .replace(/&amp;/gi, "&").replace(/&#0*39;|&apos;|&rsquo;|&#8217;/gi, "'").replace(/&quot;/gi, '"')
  .replace(/&ndash;|&#8211;/gi, "–").replace(/&mdash;|&#8212;/gi, "—").replace(/&nbsp;/gi, " ").replace(/&#x27;/gi, "'");
const GENERIC_TITLE = /^(home(\s*page)?|welcome|index|contact(\s+us)?|about(\s+us)?|services|official\s+(site|website))$/i;

/** The business's name as its OWN website states it (og:site_name, else the <title>), else its domain. */
export function siteBusinessName(html: string, website: string): string | null {
  let host = "";
  try { host = new URL(website).hostname.replace(/^www\./i, ""); } catch { return null; }
  const label = host.split(".")[0]?.toLowerCase() ?? "";
  const og = /<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1]
    ?? /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i.exec(html)?.[1];
  const clean = (s: string) => decodeEntities(s).replace(/\s+/g, " ").trim();
  if (og && clean(og).length >= 2) return clean(og).slice(0, 200);
  const title = clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  const parts = title.split(/\s+[|–—:·•-]\s+/).map((p) => p.trim()).filter((p) => p.length >= 2 && !GENERIC_TITLE.test(p));
  // Prefer the title segment that matches the domain ("Commercial Plumbing SA | Alamo Plumbing" on alamoplumbing.com).
  const overlap = (p: string) => p.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && label.includes(w)).length;
  const best = [...parts].sort((a, b) => overlap(b) - overlap(a))[0];
  if (best) return best.slice(0, 200);
  return label.length >= 2 ? host : null;
}

/**
 * A buyer row built ONLY from the business's own website, plus the Google place_id.
 * Google Places content (name, phone, address, ...) may not be stored, so nothing from
 * the Places result is accepted here: the name, email and phone all come from the site.
 */
export function buyerFromOwnSite(input: { placeId: string; trade: Trade; website: string; html: string; email: string | null; phone: string | null }): BuyerRow | null {
  if (!input.html) return null;
  const name = siteBusinessName(input.html, input.website);
  if (!name || !isContractorName(name)) return null;
  return {
    business_name: name.slice(0, 200), trade: input.trade, email: input.email, phone: input.phone,
    website: input.website, address: null, source_url: `https://www.google.com/maps/place/?q=place_id:${input.placeId}`,
  };
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

/** Central-time sending window: every day 9:00am–4:59pm. */
/** Sending warms up the new outreach inbox: 25/day for the first 3 days after the first send,
 *  50/day through day 7, then 100/day. Sudden volume from a fresh Gmail gets it flagged. */
export function rampCap(firstSentAt: Date | null, now = new Date()) {
  if (!firstSentAt) return 25;
  const days = Math.floor((now.getTime() - firstSentAt.getTime()) / 86400_000);
  return days < 3 ? 25 : days < 7 ? 50 : 100;
}
/** Eight in-window runs a day (9am–4pm hours). Each run sends a quarter of the day's cap, so the
 *  day's emails go out in the first few runs and the later runs catch up if one fails. */
export const perRunFor = (cap: number) => Math.max(1, Math.ceil(cap / 4));

// Owner, 2026-11-08: start outreach right away, including weekends (contractors work Saturdays).
export function inSendWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
  return hour >= 9 && hour <= 16;
}

// Projects in the New Openings Pack per trade: 16 restaurant/retail + 13 auto (hood cleaning and kitchen equipment skip auto).
export const FOOD_OPENINGS = 12;
export const AUTO_OPENINGS = 10;
export const packProjects = (trade: Trade) => FOOD_OPENINGS + (trade === "hood_cleaning" || trade === "kitchen_equipment" ? 0 : AUTO_OPENINGS);

// Launch promo (owner, 2026-11-08): same packs and prices as the LinkedIn post and the free
// sample page. Paid by Square invoice after we confirm the trade still has open spots, so the
// email asks for a reply instead of linking to checkout. buyUrl links are kept for the owner's
// own use but the outreach email never shows them (scripts/leadbiz.test.cjs enforces this).
export const LEADBIZ_SITE_URL = "https://san-antonio-new-openings.vercel.app";
export const LEADBIZ_SAMPLE_URL = `${LEADBIZ_SITE_URL}/project-sample.html?ref=email`;
export const LEADBIZ_LOGO_URL = `${LEADBIZ_SITE_URL}/chill-pros-logo.png`;
export const LEADBIZ_EMAIL = "satxnewopenings@gmail.com";
export const LEADBIZ_POWERED_BY = "Powered by Chill Pros";
// Launch promo ($49/$89/$119) ended by the owner on 2026-11-12: every card, email and the site now show
// the regular prices, matching chillbros_leadpack_products and the regular Square links.
// (Name kept as PROMO_PACKS so existing imports keep working.)
export const PROMO_PACKS: readonly { name: string; cards: number; price: number; buyUrl: string }[] = [
  { name: "Starter Pack", cards: 5, price: 89, buyUrl: "https://square.link/u/IlWFL0ci" },
  { name: "Trade Pack", cards: 9, price: 149, buyUrl: "https://square.link/u/FY9LJP2N" },
  { name: "Growth Pack", cards: 13, price: 199, buyUrl: "https://square.link/u/XpXPZGtI" },
];
/** Promo packs this trade can actually be filled with today (hood/kitchen get restaurant projects only). */
export const promoPacksFor = (trade: Trade) => PROMO_PACKS.filter((p) => p.cards <= packProjects(trade));

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const claimHref = (pack: string, plural: string, business: string) =>
  `mailto:${LEADBIZ_EMAIL}?subject=${encodeURIComponent(`${pack} availability: ${plural}`)}&body=${encodeURIComponent(`Hi, I'd like the ${pack}. Business: ${business}`)}`;

/** A business name fit for "Hi X team," or null when it is really a web page title or a domain
 *  ("Mysite", "Janiking.com", "Sign Shop | Signs of San Antonio", "Welcome to ..."). */
export function greetingName(name: string) {
  const n = name.trim();
  if (!n || n.length > 40 || /[|:]|^welcome\b|^home\b|^mysite$|\.(com|net|org|us|biz)$/i.test(n)) return null;
  return n;
}

export function offerEmail(b: { business_name: string; trade: Trade }, unsubscribeUrl: string, followUp = false) {
  const t = TRADE_LABEL[b.trade];
  const gName = greetingName(b.business_name);
  const greeting = gName ? `Hi ${gName} team,` : "Hi there,";
  const n = packProjects(b.trade);
  const packs = promoPacksFor(b.trade);
  const mix = n > FOOD_OPENINGS ? `${FOOD_OPENINGS} new restaurants, grocery and quick-service openings plus ${AUTO_OPENINGS} new car washes, oil change, collision and auto repair shops` : "new restaurants, grocery and quick-service openings";
  const subject = followUp
    ? `Re: ${n} new San Antonio commercial projects for ${t.plural}`
    : `${n} new San Antonio commercial projects for ${t.plural}: free sample inside`;
  // Owner + ChatGPT method (2026-11-09): honest fit ("may need", not "will need"), no struck-through
  // "regular" prices, and request-first: we confirm availability, then send a Square invoice.
  const opener = followUp
    ? `Quick follow-up on the San Antonio project cards. Each project goes to no more than ${MAX_BUYERS_PER_TRADE} ${t.plural}, and packs start at $89.`
    : `I track new commercial build-outs across San Antonio from Texas state construction filings. Right now there are ${n} active projects (${mix}). Jobs like these often need ${t.hook}. Each card shows the project stage, who to call and why it may fit your trade, so you can decide which ones are worth the call.`;
  const how = `Reply to this email with the pack name, your trade and your service area. We confirm open projects and delivery timing first, then send a Square invoice. Your project cards arrive by email after you pay. Questions? Call or text ${LEADBIZ_PHONE}.`;

  const text = [
    greeting,
    "",
    opener,
    "",
    `See an example project card, real filing with contact details redacted (takes 10 seconds): ${LEADBIZ_SAMPLE_URL}`,
    "",
    `Project packs. Availability is limited by trade and service area (never more than ${MAX_BUYERS_PER_TRADE} ${t.plural} get the same project):`,
    ...packs.map((p) => `- ${p.name}: ${p.cards} cards · $${p.price}`),
    "",
    how,
    "",
    `"${LEADBIZ_QUOTE}"`,
    "",
    `${LEADBIZ_BRAND} · ${LEADBIZ_POWERED_BY}`,
    `${LEADBIZ_PHONE} · ${LEADBIZ_EMAIL}`,
    LEADBIZ_POSTAL,
    `Lead Pack Terms: ${LEADBIZ_TERMS_URL}`,
    "",
    `You're getting this business email because ${b.business_name} is listed as a San Antonio contractor. Not interested? Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  const navy = "#0b1e33", sky = "#7fd4ff", gold = "#f5c542", muted = "#c9d6e3";
  const packCells = packs.map((p) => `<td style="padding:6px;width:${Math.floor(100 / packs.length)}%" valign="top"><div style="border:1px solid #36526b;border-radius:8px;padding:14px;background:#102a44">
<div style="color:#fff;font-weight:700;font-size:16px">${esc(p.name)}</div>
<div style="color:${muted};font-size:14px">${p.cards} cards</div>
<div style="margin:6px 0 10px"><span style="color:${gold};font-weight:700;font-size:26px">$${p.price}</span></div>
<a href="${esc(claimHref(p.name, t.plural, b.business_name))}" style="display:inline-block;background:${sky};color:${navy};font-weight:700;text-decoration:none;border-radius:8px;padding:8px 12px;font-size:14px">Check availability</a></div></td>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#081627">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#081627"><tr><td align="center" style="padding:20px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:Arial,Helvetica,sans-serif;color:#fff">
<tr><td style="background:${navy};border:2px solid #ff7a59;border-radius:14px;padding:22px">
<div style="color:${sky};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">San Antonio New Openings</div>
<div style="font-size:24px;font-weight:700;margin-top:6px;color:#fff">${n} new commercial projects for ${esc(t.plural)}</div>
</td></tr>
<tr><td style="height:12px"></td></tr>
<tr><td style="background:${navy};border-radius:14px;padding:22px;font-size:16px;line-height:1.5;color:${muted}">
<p style="margin:0 0 12px;color:#fff">${esc(greeting)}</p>
<p style="margin:0 0 16px">${esc(opener)}</p>
<p style="margin:0 0 18px"><a href="${LEADBIZ_SAMPLE_URL}" style="display:inline-block;background:${sky};color:${navy};font-weight:700;text-decoration:none;border-radius:8px;padding:12px 18px">See an example card</a></p>
<div style="background:${gold};color:${navy};font-weight:700;font-size:18px;border-radius:8px;padding:10px 14px;margin-bottom:8px;text-align:center">Project packs from $89</div>
<div style="font-size:14px;margin-bottom:6px">Limited availability by trade and service area. Never more than ${MAX_BUYERS_PER_TRADE} ${esc(t.plural)} get the same project.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${packCells}</tr></table>
<p style="margin:16px 0 0">${esc(how)}</p>
<p style="margin:16px 0 0;font-style:italic">&ldquo;${esc(LEADBIZ_QUOTE)}&rdquo;</p>
</td></tr>
<tr><td style="padding:18px 22px;font-size:12px;line-height:1.5;color:#8a9bb0">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:8px" valign="middle"><img src="${LEADBIZ_LOGO_URL}" alt="Chill Pros logo" height="36" style="height:36px;width:auto;display:block;border:0"></td><td valign="middle" style="color:#fff;font-size:14px;font-weight:700">${LEADBIZ_POWERED_BY}</td></tr></table>
<p style="margin:10px 0 0">${LEADBIZ_BRAND} is a service of Chill Professionals LLC · <a href="tel:+12109049306" style="color:${sky}">${LEADBIZ_PHONE}</a> · <a href="mailto:${LEADBIZ_EMAIL}" style="color:${sky}">${LEADBIZ_EMAIL}</a><br>${esc(LEADBIZ_POSTAL)}<br><a href="${LEADBIZ_TERMS_URL}" style="color:${sky}">Lead Pack Terms</a></p>
<p style="margin:10px 0 0">You're getting this business email because ${esc(b.business_name)} is listed as a San Antonio contractor. Not interested? <a href="${esc(unsubscribeUrl)}" style="color:${sky}">Unsubscribe</a>.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
