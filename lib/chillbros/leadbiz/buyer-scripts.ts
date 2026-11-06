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
  `Hi, this is [your name] with ${LEADBIZ_BRAND}. We track new commercial build-outs from state filings. I've got new commercial projects building in San Antonio right now, restaurants, retail and auto shops, and each one needs ${need}, with the owner's contact and phone. No more than 3 ${plural} ever get the same project. Can I text you the link? Packs start at $89 for 5 projects: ${LEADBIZ_SALES_URL}`]));

export const CALL_RESULTS: [string, string][] = [["", "Not called"], ["called", "No answer / VM"], ["callback", "Call back"], ["interested", "Interested, link sent"], ["sold", "Sold"], ["not_interested", "Not interested"], ["wrong_number", "Wrong number"]];
export const RESULT_LABEL = Object.fromEntries(CALL_RESULTS) as Record<string, string>;
