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

// Buy buttons go to the main sales page, which asks the trade and checks that trade still has
// open projects (max 3 buyers per trade per project) before sending the buyer to Square.
// Lineup mirrors lib/chillbros/leadbiz/catalog.ts in the main app.
export const SALES_URL = "https://chill-bros.vercel.app/new-openings";
const buy = (key: string) => `${SALES_URL}?pack=${key}`;

export const PACKS = [
  { key: "starter", name: "Starter Pack", price: "$89", period: "", was: null, href: buy("starter"), best: false, badge: null,
    points: () => ["5 verified new openings & remodels", "Owner or tenant contact + phone", "Project size, cost & timing", "Call opener for your trade"] },
  { key: "trade", name: "Trade Pack", price: "$149", period: "", was: null, href: buy("trade"), best: false, badge: null,
    points: () => ["9 verified new openings & remodels", "Owner or tenant contact + phone", "Project size, cost & timing", "Call opener for your trade"] },
  { key: "growth", name: "Growth Pack", price: "$199", period: "", was: null, href: buy("growth"), best: true, badge: null,
    points: () => ["13 verified new openings & remodels", "Owner or tenant contact + phone", "Project size, cost & timing", "Call opener for your trade"] },
  { key: "pro", name: "Pro Bundle", price: "$249", period: "", was: null, href: buy("pro"), best: false, badge: null,
    points: () => ["16 verified new openings & remodels", "+ 50 basic business contacts", "Call openers for your trade", "Spreadsheet download"] },
  { key: "local", name: "Local Plan", price: "$99", period: "/mo", was: null, href: buy("local"), best: false, badge: "Monthly",
    points: () => ["At least 6 new projects every month", "Never the same project twice", "12-month term, billed monthly"] },
  { key: "pro_plan", name: "Pro Plan", price: "$179", period: "/mo", was: null, href: buy("pro_plan"), best: false, badge: "Monthly",
    points: () => ["At least 12 new projects every month", "Two batches a month", "Never the same project twice", "12-month term, billed monthly"] },
] as const;

export const TRADES = ["Plumbers", "Electricians", "Hood cleaners", "Pest control", "Commercial cleaning", "Sign companies", "Low voltage", "Security", "HVAC & refrigeration", "Hot side / kitchen equipment"];
