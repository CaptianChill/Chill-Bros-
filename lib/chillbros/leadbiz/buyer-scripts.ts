// Call scripts and result labels for the Lead Buyers list (app tab and PDFs).
import { LEADBIZ_BRAND, LEADBIZ_SALES_URL } from "./buyers";

const hook: Record<string, [string, string]> = {
  Electricians: ["electricians", "panels, kitchen circuits and lighting before inspection"],
  Plumbers: ["plumbers", "rough-in, grease traps and backflow before opening day"],
  "Pest control": ["pest control companies", "a pest program in place before its health inspection"],
  "Sign companies": ["sign companies", "storefront and pylon signs before opening day"],
  "HVAC & refrigeration": ["HVAC and refrigeration companies", "rooftop units, walk-in coolers and ice machines installed and serviced"],
};

export const BUYER_TRADES = Object.keys(hook);
export const BUYER_SCRIPTS: Record<string, string> = Object.fromEntries(Object.entries(hook).map(([t, [plural, need]]) => [t,
  `Hi, this is [your name] with ${LEADBIZ_BRAND}. We track new commercial build-outs in San Antonio from Texas state filings: restaurants, retail and auto shops. Jobs like these often need ${need}. Each card shows the project stage, who's listed on the filing and why it may fit your trade. No more than 3 ${plural} get the same project. Can I text you a real example? Packs start at $49 for 5 projects: ${LEADBIZ_SALES_URL}`]));

export const CALL_RESULTS: [string, string][] = [["", "Not called"], ["called", "No answer / VM"], ["callback", "Call back"], ["interested", "Interested, link sent"], ["sold", "Sold"], ["not_interested", "Not interested"], ["wrong_number", "Wrong number"]];
export const RESULT_LABEL = Object.fromEntries(CALL_RESULTS) as Record<string, string>;
