import "server-only";

import { discoverCityEstablishments, type CityEstablishment } from "./revenue-city-source";
import { normalizedKey } from "@/lib/chillbros/revenue-radar";
import type { createServiceRoleClient } from "@/lib/supabase/service-client";

// Revenue Radar's automatic lead finder. It searches public OpenStreetMap business
// listings one area of greater San Antonio at a time, rotating through the areas so
// each run finds businesses it hasn't seen yet, and keeps going until it has added
// enough new leads. Independent businesses (no national brand) and reachable ones
// (phone/website listed) rank higher; existing Chill Pros customers are skipped.

export type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string>;
};

type OverpassPayload = { elements?: OsmElement[]; remark?: string };

export type DiscoveredRevenueLead = {
  business_name: string;
  city: string;
  category: "other";
  service_line: "hvac_r" | "refrigeration" | "ice_machine" | "kitchen_equipment" | "exhaust_hood" | "multiple";
  signal_summary: string;
  source_url: string;
  signal_observed_at: string;
  signal_verified: false;
  normalized_key: string;
  score: number;
  business_address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export type ScanArea = { name: string; lat: number; lon: number; radiusM: number };

// Greater San Antonio, split into areas small enough that one search returns the
// whole area instead of the same first batch every time.
export const SCAN_AREAS: ScanArea[] = [
  { name: "Downtown / Southtown", lat: 29.4241, lon: -98.4936, radiusM: 4500 },
  { name: "Alamo Heights / Terrell Hills", lat: 29.4855, lon: -98.4655, radiusM: 4500 },
  { name: "Medical Center", lat: 29.5084, lon: -98.5786, radiusM: 5000 },
  { name: "Airport / North Central", lat: 29.5337, lon: -98.4698, radiusM: 5000 },
  { name: "Stone Oak / Hollywood Park", lat: 29.6219, lon: -98.4823, radiusM: 6000 },
  { name: "Northeast / Windcrest", lat: 29.5260, lon: -98.3800, radiusM: 5500 },
  { name: "Converse / Live Oak / Universal City", lat: 29.5600, lon: -98.3100, radiusM: 6000 },
  { name: "Schertz / Cibolo / Selma", lat: 29.5900, lon: -98.2600, radiusM: 6500 },
  { name: "East Side / Fort Sam", lat: 29.4300, lon: -98.4200, radiusM: 5000 },
  { name: "Southeast / Brooks", lat: 29.3500, lon: -98.4400, radiusM: 6000 },
  { name: "South Side / Palo Alto", lat: 29.3400, lon: -98.5300, radiusM: 6000 },
  { name: "Southwest / Lackland", lat: 29.3900, lon: -98.6200, radiusM: 6000 },
  { name: "West Side", lat: 29.4350, lon: -98.5600, radiusM: 4500 },
  { name: "Leon Valley / Northwest", lat: 29.4950, lon: -98.6350, radiusM: 5500 },
  { name: "Helotes / 1604 West", lat: 29.5600, lon: -98.6700, radiusM: 6500 },
  { name: "La Cantera / UTSA / Shavano Park", lat: 29.5900, lon: -98.5900, radiusM: 5500 },
];

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

// Every outside call gets at most this long, and never past the run's deadline.
const REQUEST_TIMEOUT_MS = 20000;

function timeLeft(deadline: number) {
  return deadline - Date.now();
}

export async function fetchOverpass(query: string, deadline: number): Promise<OverpassPayload> {
  const failures: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const budget = Math.min(REQUEST_TIMEOUT_MS, timeLeft(deadline) - 2000);
    if (budget < 3000) { failures.push("out of time"); break; }
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          "user-agent": "CommercialListingDiscovery/1.3 (read-only business map search)",
          accept: "application/json",
        },
        body: new URLSearchParams({ data: query }),
        cache: "no-store",
        signal: AbortSignal.timeout(budget),
      });
      if (!response.ok) { failures.push(`${new URL(endpoint).hostname} ${response.status}`); continue; }
      const payload = (await response.json()) as OverpassPayload;
      // Overpass can return HTTP 200 with partial elements and a runtime error.
      if (Array.isArray(payload.elements) && !payload.remark) return payload;
      failures.push(`${new URL(endpoint).hostname} bad payload`);
    } catch (error) {
      // Public Overpass instances can be overloaded or temporarily unreachable.
      // Try the next global instance before surfacing a failure to the user.
      failures.push(`${new URL(endpoint).hostname} ${error instanceof Error ? error.name : "error"}`);
    }
  }
  console.warn("[revenue-discovery] map search failed", failures.join("; "));
  throw new Error("Lead discovery sources are temporarily unavailable. Revenue Radar tried all configured discovery sources; try the scan again shortly.");
}

// No Google Places here, ever. Google's terms forbid storing Places content (other
// than place_id) and forbid reselling it, and prospects saved here can end up in the
// lead packs we sell. Discovery uses only free/public sources: OpenStreetMap and the
// City of San Antonio's published reports. scripts/revenue-discovery.test.cjs checks
// that discovery never calls places.googleapis.com, even when GOOGLE_PLACES_API_KEY is set.

export function serviceFit(tags: Record<string, string>) {
  const amenity = tags.amenity ?? "";
  const shop = tags.shop ?? "";
  const tourism = tags.tourism ?? "";

  if (["supermarket", "convenience", "butcher", "seafood", "deli"].includes(shop)) {
    return { service_line: "refrigeration" as const, score: 72, reason: "refrigeration-heavy retail" };
  }
  if (["restaurant", "fast_food", "food_court"].includes(amenity)) {
    return { service_line: "multiple" as const, score: 70, reason: "potential service fit for fryers, ovens, ranges, griddles, steamers, dishwashers, hoods, exhaust, makeup air, refrigeration, ice, and HVAC (equipment and current need unverified)" };
  }
  if (amenity === "nursing_home") {
    return { service_line: "multiple" as const, score: 68, reason: "potential 24/7 HVAC, refrigeration, and kitchen service: ovens, ranges, steamers, dishwashers, hoods, exhaust, and makeup air (equipment and current need unverified)" };
  }
  if (amenity === "ice_cream" || ["alcohol", "beverages"].includes(shop)) {
    return { service_line: "refrigeration" as const, score: 66, reason: "walk-in coolers, freezers, and display refrigeration" };
  }
  if (["cafe", "bar", "pub"].includes(amenity) || shop === "bakery") {
    return { service_line: "kitchen_equipment" as const, score: 64, reason: "potential kitchen service: ovens, griddles, warming equipment, dishwashers, ventilation, and HVAC (equipment and current need unverified)" };
  }
  if (tourism === "hotel") {
    return { service_line: "hvac_r" as const, score: 62, reason: "high HVAC runtime and guest-comfort exposure" };
  }
  if (shop === "florist") {
    return { service_line: "refrigeration" as const, score: 60, reason: "floral coolers" };
  }
  if (tourism === "motel") {
    return { service_line: "hvac_r" as const, score: 58, reason: "many room HVAC units" };
  }
  // Professional/commercial HVAC buyers.
  if (tags.office === "property_management") {
    return { service_line: "hvac_r" as const, score: 66, reason: "manages many buildings and tenant comfort calls" };
  }
  if (["clinic", "dentist", "doctors", "veterinary"].includes(amenity)) {
    return { service_line: "hvac_r" as const, score: 62, reason: "patient comfort and temperature-sensitive supplies" };
  }
  if (["school", "kindergarten", "place_of_worship"].includes(amenity) || tags.leisure === "fitness_centre" || shop === "car") {
    return { service_line: "hvac_r" as const, score: 58, reason: "large spaces with heavy HVAC load" };
  }
  return { service_line: "hvac_r" as const, score: 48, reason: "commercial HVAC demand" };
}

// Lead score from business type, adjusted for how winnable and reachable it is.
export function scoreLead(tags: Record<string, string>) {
  const fit = serviceFit(tags);
  const notes: string[] = [];
  let score = fit.score;
  const chain = Boolean(tags.brand || tags["brand:wikidata"]);
  if (chain) { score -= 15; notes.push("national/regional brand (vendor is often chosen by corporate)"); }
  else { score += 4; notes.push("no brand listed (ownership and vendor authority unverified)"); }
  if (tags.phone || tags["contact:phone"]) { score += 6; notes.push("phone listed"); }
  if (tags.website || tags["contact:website"]) { score += 3; notes.push("website listed"); }
  if (tags["addr:street"]) score += 2;
  return { ...fit, score: Math.max(10, Math.min(95, score)), chain, notes };
}

function addressFrom(tags: Record<string, string>) {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const locality = [tags["addr:city"], tags["addr:state"], tags["addr:postcode"]].filter(Boolean).join(", ");
  return [street, locality].filter(Boolean).join(", ") || null;
}

export const nameKey = (value: string) => value.toLowerCase().normalize("NFKD").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\b(the|llc|inc|co)\b/g, " ").replace(/\s+/g, " ").trim();

// Turns one area's map results into ranked leads, best first.
export function leadsFromElements(elements: OsmElement[], area: ScanArea, now: string, skipNames: Set<string> = new Set()): DiscoveredRevenueLead[] {
  const seen = new Set<string>();
  const leads: DiscoveredRevenueLead[] = [];
  for (const element of elements) {
    const tags = element.tags ?? {};
    const name = (tags.name || tags.brand || tags.operator || "").trim();
    if (!name || name.length < 2) continue;
    const key = nameKey(name);
    if (skipNames.has(key)) continue;
    const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
    if (seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);

    const fit = scoreLead(tags);
    const website = tags.website || tags["contact:website"] || null;
    leads.push({
      business_name: name.slice(0, 200),
      city: "San Antonio",
      category: "other",
      service_line: fit.service_line,
      signal_summary: `Automatically discovered in ${area.name}. Business type indicates ${fit.reason}; ${fit.notes.join(", ")}.${website ? ` Website: ${website.slice(0, 200)}.` : ""} Office review is still required before outreach.`.slice(0, 1000),
      source_url: sourceUrl,
      signal_observed_at: now,
      signal_verified: false,
      normalized_key: normalizedKey(name, "San Antonio", "auto_discovery", sourceUrl),
      score: fit.score,
      business_address: addressFrom(tags),
      contact_email: tags.email || tags["contact:email"] || null,
      contact_phone: tags.phone || tags["contact:phone"] || null,
    });
  }
  return leads.sort((a, b) => b.score - a.score);
}

export async function discoverAreaLeads(area: ScanArea, skipNames: Set<string> = new Set(), deadline = Date.now() + 60000): Promise<DiscoveredRevenueLead[]> {
  // Indexed bounding-box searches avoid three expensive radial geometry scans.
  // Server timeout must expire before the 20-second HTTP request timeout.
  const latDelta = area.radiusM / 111320;
  const lonDelta = latDelta / Math.cos(area.lat * Math.PI / 180);
  const bounds = `(${area.lat - latDelta},${area.lon - lonDelta},${area.lat + latDelta},${area.lon + lonDelta})`;
  const query = `
[out:json][timeout:12];
(
  nwr["amenity"~"^(restaurant|fast_food|cafe|bar|pub|food_court|ice_cream|nursing_home)$"]["name"]${bounds};
  nwr["shop"~"^(supermarket|convenience|bakery|butcher|seafood|deli|alcohol|beverages|florist)$"]["name"]${bounds};
  nwr["tourism"~"^(hotel|motel)$"]["name"]${bounds};
  nwr["amenity"~"^(clinic|dentist|doctors|veterinary)$"]["name"]${bounds};
);
out tags center 600;
`;
  const payload = await fetchOverpass(query, deadline);
  return leadsFromElements(payload.elements ?? [], area, new Date().toISOString(), skipNames);
}

// Scheduled scans advance each quarter hour; retain daily mode for older callers.
export function startAreaIndex(mode: "daily" | "manual" | "scheduled", now = new Date()) {
  if (mode === "scheduled") return Math.floor(now.getTime() / 900000) % SCAN_AREAS.length;
  if (mode === "daily") return Math.floor(now.getTime() / 86400000) % SCAN_AREAS.length;
  return Math.floor(Math.random() * SCAN_AREAS.length);
}

type Client = ReturnType<typeof createServiceRoleClient>;
export type LeadScanResult = { added: number; scanned: string[]; skippedCustomers: number; source: "openstreetmap" | "san-antonio-reports" };

// Business names already in Revenue Radar, so a business found again through a
// different source (city reports vs OpenStreetMap) isn't added twice.
async function existingProspectNames(client: Client) {
  const names = new Set<string>();
  const sources = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from("chillbros_revenue_prospects").select("business_name,source_url").order("id").range(from, from + 999);
    if (error || data === null) throw new Error("Existing prospects could not be read; discovery stopped to prevent duplicates.");
    for (const row of data as { business_name: string | null; source_url: string | null }[]) {
      names.add(nameKey(row.business_name ?? ""));
      if (row.source_url) sources.add(row.source_url.toLowerCase().replace(/\/$/, ""));
    }
    if (!data || data.length < 1000) break;
  }
  return { names, sources };
}

// Customer names, so a business that is already a customer never becomes a prospect.
async function existingCustomerNames(client: Client) {
  const customerNames = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from("chillbros_customers").select("name").order("id").range(from, from + 999);
    if (error || data === null) throw new Error("Existing customers could not be read; discovery stopped to prevent customer imports.");
    for (const row of data as { name: string | null }[]) {
      const key = nameKey(row.name ?? "");
      if (key.length > 2) customerNames.add(key);
    }
    if (data.length < 1000) break;
  }
  return customerNames;
}

// Saves businesses from the city's published food-establishment report as new prospects, skipping customers,
// businesses already in Revenue Radar and repeats. This source has no contacts, and its food-safety score is never
// used as a sales qualification score.
export async function saveCityEstablishments(
  client: Client,
  businesses: CityEstablishment[],
  options: { actorId: string | null; target: number; customerNames?: Set<string>; knownNames?: Set<string>; knownSources?: Set<string> },
): Promise<LeadScanResult> {
  const customerNames = options.customerNames ?? await existingCustomerNames(client);
  const known = options.knownNames && options.knownSources ? { names: options.knownNames, sources: options.knownSources } : await existingProspectNames(client);
  const fit = scoreLead({ amenity: "restaurant" });
  let skippedCustomers = 0;
  const rows: DiscoveredRevenueLead[] = [];
  for (const business of businesses) {
    const key = nameKey(business.name);
    if (customerNames.has(key)) { skippedCustomers++; continue; }
    if (known.names.has(key) || known.sources.has(business.sourceUrl.toLowerCase())) continue;
    known.names.add(key);
    rows.push({
      business_name: business.name.slice(0, 200), city: "San Antonio", category: "other", service_line: "multiple",
      signal_summary: `City of San Antonio published food-establishment record, observed ${business.observedAt.slice(0, 10)}. Potential kitchen, refrigeration, ice, HVAC, and ventilation service fit; equipment, ownership, vendor authority, and current need unverified. Food inspection scores are not lead qualification scores. Office review required.`,
      source_url: business.sourceUrl, signal_observed_at: business.observedAt, signal_verified: false,
      normalized_key: normalizedKey(business.name, "San Antonio", "auto_discovery", business.sourceUrl),
      score: fit.score, business_address: business.address, contact_email: null, contact_phone: null,
    });
  }
  const scanned = ["San Antonio official food-establishment reports"];
  const fresh = rows.slice(0, options.target).map(lead => ({ ...lead, status: "new", created_by: options.actorId, updated_by: options.actorId, updated_at: new Date().toISOString() }));
  // A valid empty/fully deduplicated report is a successful scan, not an outage.
  if (!fresh.length) return { added: 0, scanned, skippedCustomers, source: "san-antonio-reports" };
  const { data, error } = await client.from("chillbros_revenue_prospects").upsert(fresh, { onConflict: "normalized_key", ignoreDuplicates: true }).select("id");
  if (error) throw new Error(`City discovery save failed: ${error.message}`);
  return { added: data?.length ?? 0, scanned, skippedCustomers, source: "san-antonio-reports" };
}

// Scans areas in rotation until about `target` new leads are added (max `maxAreas`
// areas, to stay polite to the free map service). Duplicates are ignored by the
// database's normalized_key and by business name, so only genuinely new businesses
// count. Stops starting new searches once `budgetMs` is used, so the run always
// finishes and saves what it found instead of being killed by the platform timeout.
export async function runLeadScan(client: Client, options: { mode: "daily" | "manual" | "scheduled"; actorId: string | null; target?: number; maxAreas?: number; budgetMs?: number }): Promise<LeadScanResult> {
  const target = options.target ?? 25;
  const maxAreas = Math.min(options.maxAreas ?? 3, SCAN_AREAS.length);
  const deadline = Date.now() + (options.budgetMs ?? 50000);
  const customerNames = await existingCustomerNames(client);
  const { names: knownNames, sources: knownSources } = await existingProspectNames(client);

  // Prefer the city's current, published local records to overloaded public map
  // servers. This source has no contacts
  // and its food-safety score is never used as a sales qualification score.
  // RADAR_CITY_FROM_PC=1: the city blocks cloud servers, so the owner's PC fetches the report and posts it to
  // /api/cron/radar-city-import instead; the cloud scan then skips straight to the map search.
  if (process.env.RADAR_CITY_FROM_PC !== "1") {
    try {
      const businesses = await discoverCityEstablishments(deadline);
      return await saveCityEstablishments(client, businesses, { actorId: options.actorId, target, customerNames, knownNames, knownSources });
    } catch (error) {
      // A database failure must not fall through and import without its exclusions.
      if (error instanceof Error && error.message.startsWith("City discovery save failed:")) throw error;
      console.warn("[revenue-discovery] official city source unavailable", error instanceof Error ? error.message : "error");
    }
  }

  const start = startAreaIndex(options.mode);
  const result: LeadScanResult = { added: 0, scanned: [], skippedCustomers: 0, source: "openstreetmap" };
  let lastError: Error | null = null;
  for (let i = 0; i < maxAreas && result.added < target && timeLeft(deadline) > 8000; i++) {
    const area = SCAN_AREAS[(start + i) % SCAN_AREAS.length];
    let all: DiscoveredRevenueLead[] = [];
    try {
      all = await discoverAreaLeads(area, new Set(), deadline);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Lead discovery failed.");
      if (!all.length) continue;
    }
    const leads = all.filter((lead) => !customerNames.has(nameKey(lead.business_name)));
    result.skippedCustomers += all.length - leads.length;
    result.scanned.push(area.name);
    const fresh = leads.filter((lead) => {
      const key = nameKey(lead.business_name);
      const source = lead.source_url.toLowerCase().replace(/\/$/, "");
      if (knownNames.has(key) || knownSources.has(source)) return false;
      knownNames.add(key);
      knownSources.add(source);
      return true;
    });
    if (!fresh.length) continue;
    const now = new Date().toISOString();
    const rows = fresh.map((lead) => ({ ...lead, status: "new", created_by: options.actorId, updated_by: options.actorId, updated_at: now }));
    const { data, error } = await client.from("chillbros_revenue_prospects").upsert(rows, { onConflict: "normalized_key", ignoreDuplicates: true }).select("id");
    if (error) throw new Error(error.message);
    result.added += data?.length ?? 0;
  }
  if (!result.scanned.length && lastError) throw lastError;
  return result;
}

// Kept for any caller that wants a plain list (first area of today's rotation).
export async function discoverSanAntonioRevenueLeads(limit = 60): Promise<DiscoveredRevenueLead[]> {
  return (await discoverAreaLeads(SCAN_AREAS[startAreaIndex("daily")])).slice(0, limit);
}
