// Everything brand-specific lives here. To rebrand (new name/domain), edit this file only.
export const BRAND = {
  name: "San Antonio New Openings",
  eyebrow: "San Antonio",
  wordmark: "New Openings",
  tagline: "Know who's building before your competition does.",
  quote: "We work these job sites every week. We know which ones are worth the call.",
  phone: "(210) 904-9306",
  email: "satxnewopenings@gmail.com",
  legal: "A service of Chill Professionals LLC",
  attribution: "Project data from public Texas Department of Licensing and Regulation filings. Business data © OpenStreetMap contributors.",
};

// The one buying menu (owner, 2026-11-09): launch prices, request first. "Check availability" opens the
// sample page's pack section; we confirm open projects and timing, then send a Square invoice.
export const SAMPLE_URL = "/project-sample.html";
const request = `${SAMPLE_URL}#packs`;

export const PACKS = [
  { key: "starter", name: "Starter Pack", price: "$89", period: "", was: null, href: request, best: false, badge: "Start here",
    points: () => ["5 project cards for one trade and area", "Source filing, stage and target timing", "Who's listed on the filing", "Why it may fit your trade + a first question"] },
  { key: "trade", name: "Trade Pack", price: "$149", period: "", was: null, href: request, best: false, badge: null,
    points: () => ["9 project cards for one trade and area", "Source filing, stage and target timing", "Who's listed on the filing", "Why it may fit your trade + a first question"] },
  { key: "growth", name: "Growth Pack", price: "$199", period: "", was: null, href: request, best: true, badge: null,
    points: () => ["13 project cards for one trade and area", "Source filing, stage and target timing", "Who's listed on the filing", "Why it may fit your trade + a first question"] },
] as const;

export const TRADES = ["Plumbers", "Electricians", "Hood cleaners", "Pest control", "Commercial cleaning", "Sign companies", "Low voltage", "Security", "HVAC & refrigeration", "Hot side / kitchen equipment"];
