// Call scripts and result labels for the Lead Buyers list (app tab and PDFs).
import { LEADBIZ_BRAND, PAY_LINKS } from "./buyers";

const hook: Record<string, [string, string]> = {
  Electricians: ["electricians", "panels, kitchen circuits and lighting before inspection"],
  Plumbers: ["plumbers", "rough-in, grease traps and backflow before opening day"],
  "Pest control": ["pest control companies", "a pest program in place before its health inspection"],
  "Sign companies": ["sign companies", "storefront and pylon signs before opening day"],
  "HVAC & refrigeration": ["HVAC and refrigeration companies", "rooftop units, walk-in coolers and ice machines installed and serviced"],
};

export const BUYER_TRADES = Object.keys(hook);
export const BUYER_SCRIPTS: Record<string, string> = Object.fromEntries(Object.entries(hook).map(([t, [plural, need]]) => [t,
  `Hi, this is [your name] with ${LEADBIZ_BRAND}. We track new commercial build-outs from state filings. I've got 29 new commercial projects building in San Antonio right now, restaurants, retail and auto shops, and each one needs ${need}, with the owner's contact and phone. I only sell it to 3 ${plural}. Can I text you the link? It's $199 for the bundle: ${PAY_LINKS.bundle}`]));

export const CALL_RESULTS: [string, string][] = [["", "Not called"], ["called", "No answer / VM"], ["callback", "Call back"], ["interested", "Interested, link sent"], ["sold", "Sold"], ["not_interested", "Not interested"], ["wrong_number", "Wrong number"]];
export const RESULT_LABEL = Object.fromEntries(CALL_RESULTS) as Record<string, string>;
