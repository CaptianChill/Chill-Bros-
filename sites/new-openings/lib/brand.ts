// Everything brand-specific lives here. To rebrand (new name/domain), edit this file only.
export const BRAND = {
  name: "San Antonio New Openings",
  eyebrow: "San Antonio",
  wordmark: "New Openings",
  tagline: "Know who's building before your competition does.",
  quote: "We work these job sites every week. We know which ones are worth the call.",
  quoteBy: "Built by Chill Pros, San Antonio commercial HVAC & refrigeration",
  phone: "(210) 904-9306",
  email: "satxnewopenings@gmail.com",
  legal: "A service of Chill Professionals LLC",
  attribution: "Project data from public Texas Department of Licensing and Regulation filings. Business data © OpenStreetMap contributors.",
};

export const PACKS = [
  { key: "openings", name: "New Openings Pack", price: "$150", was: "$250", href: "https://square.link/u/RStoSpmq", best: false, badge: null,
    points: (n: number) => [`${n} verified new openings & remodels`, "Owner or tenant contact + phone", "Project size, cost & timing", "Max 3 buyers per trade"] },
  { key: "bundle", name: "Founding Bundle", price: "$199", was: "$299", href: "https://square.link/u/6Cdb25fY", best: true, badge: null,
    points: (n: number) => [`All ${n} new projects`, "+ 50 ready-to-call restaurants & markets", "Call openers written for your trade", "PDF + spreadsheet, delivered in 2 hours"] },
  { key: "starter", name: "Commercial Starter Pack", price: "$75", was: null, href: "https://square.link/u/DMHFLgWQ", best: false, badge: null,
    points: () => ["50 ready-to-call SA restaurants & markets", "Address, phone & business type", "Matched to your trade", "Delivered in 2 hours"] },
  { key: "auto", name: "Auto Openings Pack", price: "$99", was: null, href: "https://square.link/u/ju26cQ8a", best: false, badge: "Auto only",
    points: () => ["13 new car washes, oil change, collision & dealer service shops", "Owner or tenant contact + phone", "Call openers for your trade", "Not for hood cleaning or kitchen equipment"] },
  { key: "food", name: "Restaurant & Retail Pack", price: "$99", was: null, href: "https://square.link/u/bTgyfEEO", best: false, badge: "Food & retail only",
    points: () => ["16 new restaurant, grocery & retail build-outs", "Owner or tenant contact + phone", "Project size, cost & timing", "Call openers for your trade"] },
  { key: "exclusive", name: "Exclusive Trade Bundle", price: "$449", was: null, href: "https://square.link/u/ESlEYsen", best: false, badge: "1 buyer per trade",
    points: (n: number) => [`Everything in the Founding Bundle (${n} projects + 50 businesses)`, "You're the only company in your trade on this list", "Exclusive for 30 days", "Only while your trade is still open"] },
] as const;

export const TRADES = ["Plumbers", "Electricians", "Hood cleaners", "Pest control", "Commercial cleaning", "Sign companies", "Low voltage", "Security", "HVAC & refrigeration", "Hot side / kitchen equipment"];
