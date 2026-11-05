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
  { key: "openings", name: "New Openings Pack", price: "$150", was: "$250", href: "https://square.link/u/RStoSpmq", best: false,
    points: (n: number) => [`${n} verified new openings & remodels`, "Owner or tenant contact + phone", "Project size, cost & timing", "Max 3 buyers per trade"] },
  { key: "bundle", name: "Founding Bundle", price: "$199", was: "$299", href: "https://square.link/u/6Cdb25fY", best: true,
    points: (n: number) => [`All ${n} new projects`, "+ 50 ready-to-call restaurants & markets", "Call openers written for your trade", "PDF + spreadsheet, delivered in 2 hours"] },
  { key: "starter", name: "Commercial Starter Pack", price: "$75", was: null, href: "https://square.link/u/DMHFLgWQ", best: false,
    points: () => ["50 ready-to-call SA restaurants & markets", "Address, phone & business type", "Matched to your trade", "Delivered in 2 hours"] },
] as const;

export const TRADES = ["Plumbers", "Electricians", "Hood cleaners", "Pest control", "Commercial cleaning", "Sign companies", "Low voltage", "Security"];
