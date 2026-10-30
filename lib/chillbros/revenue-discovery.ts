import "server-only";

import { normalizedKey } from "@/lib/chillbros/revenue-radar";
import type { createServiceRoleClient } from "@/lib/supabase/service-client";

// Revenue Radar's automatic lead finder. It searches public OpenStreetMap business
// listings one area of greater San Antonio at a time, rotating through the areas so
// each run finds businesses it hasn't seen yet, and keeps going until it has added
// enough new leads. Independent businesses (no national brand) and reachable ones
// (phone/website listed) rank higher; existing Chill Pros customers are skipped.

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string>;
};

type OverpassPayload = { elements?: OsmElement[] };

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

async function fetchOverpass(query: string, deadline: number): Promise<OverpassPayload> {
  const failures: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const budget = Math.min(REQUEST_TIMEOUT_MS, timeLeft(deadline) - 2000);
    if (budget < 3000) { failures.push("out of time"); break; }
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          "user-agent": "ChillBros-RevenueRadar/1.2",
        },
        body: new URLSearchParams({ data: query }),
        cache: "no-store",
        signal: AbortSignal.timeout(budget),
      });
      if (!response.ok) { failures.push(`${new URL(endpoint).hostname} ${response.status}`); continue; }
      const payload = (await response.json()) as OverpassPayload;
      if (Array.isArray(payload.elements)) return payload;
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

// ---------- Google Places (used when GOOGLE_PLACES_API_KEY is set) ----------
// The free OpenStreetMap servers are often at capacity and San Antonio's OSM
// listings are mostly already in Revenue Radar, so Google is the main source when
// a key is configured. One request returns up to 20 businesses.

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  primaryType?: string;
  types?: string[];
  businessStatus?: string;
};

// Kitchens alternate with professional/commercial HVAC buyers (offices, property
// managers, medical, schools, churches, gyms), which feed the office outreach lane.
export const GOOGLE_QUERIES = ["restaurants", "property management companies", "grocery stores and meat markets", "medical and dental offices", "hotels and motels", "office buildings and business parks", "bars and cafes", "churches", "nursing homes and assisted living", "private schools and daycares", "bakeries and donut shops", "gyms and fitness centers", "convenience stores and liquor stores", "auto dealerships", "ice cream and snow cone shops", "veterinary clinics"];

const GOOGLE_TYPE_TAGS: Record<string, Record<string, string>> = {
  restaurant: { amenity: "restaurant" },
  fast_food_restaurant: { amenity: "fast_food" },
  meal_takeaway: { amenity: "fast_food" },
  cafe: { amenity: "cafe" },
  coffee_shop: { amenity: "cafe" },
  bar: { amenity: "bar" },
  pub: { amenity: "pub" },
  ice_cream_shop: { amenity: "ice_cream" },
  bakery: { shop: "bakery" },
  donut_shop: { shop: "bakery" },
  supermarket: { shop: "supermarket" },
  grocery_store: { shop: "supermarket" },
  butcher_shop: { shop: "butcher" },
  convenience_store: { shop: "convenience" },
  liquor_store: { shop: "alcohol" },
  florist: { shop: "florist" },
  hotel: { tourism: "hotel" },
  lodging: { tourism: "hotel" },
  motel: { tourism: "motel" },
  nursing_home: { amenity: "nursing_home" },
  real_estate_agency: { office: "property_management" },
  doctor: { amenity: "doctors" },
  medical_clinic: { amenity: "clinic" },
  dentist: { amenity: "dentist" },
  dental_clinic: { amenity: "dentist" },
  veterinary_care: { amenity: "veterinary" },
  school: { amenity: "school" },
  primary_school: { amenity: "school" },
  secondary_school: { amenity: "school" },
  preschool: { amenity: "kindergarten" },
  child_care_agency: { amenity: "kindergarten" },
  church: { amenity: "place_of_worship" },
  place_of_worship: { amenity: "place_of_worship" },
  gym: { leisure: "fitness_centre" },
  fitness_center: { leisure: "fitness_centre" },
  car_dealer: { shop: "car" },
  assisted_living_facility: { amenity: "nursing_home" },
};

// Turns a Google place into the same tag shape the OSM path scores, so both rank alike.
export function tagsFromGooglePlace(place: GooglePlace): Record<string, string> {
  const types = [place.primaryType, ...(place.types ?? [])].filter(Boolean) as string[];
  const typeTags = types.map((t) => GOOGLE_TYPE_TAGS[t] ?? (t.endsWith("_restaurant") ? { amenity: "restaurant" } : null)).find(Boolean) ?? {};
  const tags: Record<string, string> = { ...typeTags, name: place.displayName?.text ?? "" };
  if (place.nationalPhoneNumber) tags.phone = place.nationalPhoneNumber;
  if (place.websiteUri) tags.website = place.websiteUri;
  if (place.formattedAddress) tags["addr:street"] = place.formattedAddress;
  return tags;
}

async function searchGooglePlaces(apiKey: string, textQuery: string, area: ScanArea, deadline: number): Promise<GooglePlace[]> {
  const budget = Math.min(REQUEST_TIMEOUT_MS, timeLeft(deadline) - 2000);
  if (budget < 3000) throw new Error("out of time");
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
      "x-goog-fieldmask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.primaryType,places.types,places.businessStatus",
    },
    body: JSON.stringify({ textQuery: `${textQuery} in ${area.name}, San Antonio TX`, pageSize: 20, locationBias: { circle: { center: { latitude: area.lat, longitude: area.lon }, radius: Math.min(50000, area.radiusM) } } }),
    cache: "no-store",
    signal: AbortSignal.timeout(budget),
  });
  if (!response.ok) {
    console.warn("[revenue-discovery] google places failed", response.status, (await response.text().catch(() => "")).slice(0, 300));
    throw new Error(`Google Places returned ${response.status}.`);
  }
  const payload = (await response.json()) as { places?: GooglePlace[] };
  return (payload.places ?? []).filter((p) => p.id && p.displayName?.text && (!p.businessStatus || p.businessStatus === "OPERATIONAL"));
}

export function leadsFromGooglePlaces(places: GooglePlace[], area: ScanArea, now: string): DiscoveredRevenueLead[] {
  const seen = new Set<string>();
  const leads: DiscoveredRevenueLead[] = [];
  for (const place of places) {
    if (seen.has(place.id)) continue;
    seen.add(place.id);
    const tags = tagsFromGooglePlace(place);
    const name = tags.name.trim();
    if (name.length < 2) continue;
    const fit = scoreLead(tags);
    const sourceUrl = `https://www.google.com/maps/place/?q=place_id:${place.id}`;
    const website = tags.website || null;
    leads.push({
      business_name: name.slice(0, 200),
      city: "San Antonio",
      category: "other",
      service_line: fit.service_line,
      signal_summary: `Automatically discovered in ${area.name} (Google Maps). Business type indicates ${fit.reason}; ${fit.notes.join(", ")}.${website ? ` Website: ${website.slice(0, 200)}.` : ""} Office review is still required before outreach.`.slice(0, 1000),
      source_url: sourceUrl,
      signal_observed_at: now,
      signal_verified: false,
      normalized_key: normalizedKey(name, "San Antonio", "auto_discovery", sourceUrl),
      score: fit.score,
      business_address: place.formattedAddress ?? null,
      contact_email: null,
      contact_phone: place.nationalPhoneNumber ?? null,
    });
  }
  return leads.sort((a, b) => b.score - a.score);
}

export function serviceFit(tags: Record<string, string>) {
  const amenity = tags.amenity ?? "";
  const shop = tags.shop ?? "";
  const tourism = tags.tourism ?? "";

  if (["supermarket", "convenience", "butcher", "seafood", "deli"].includes(shop)) {
    return { service_line: "refrigeration" as const, score: 72, reason: "refrigeration-heavy retail" };
  }
  if (["restaurant", "fast_food", "food_court"].includes(amenity)) {
    return { service_line: "multiple" as const, score: 70, reason: "commercial cooking, refrigeration, ice, and HVAC demand" };
  }
  if (amenity === "nursing_home") {
    return { service_line: "multiple" as const, score: 68, reason: "24/7 HVAC plus commercial kitchen and refrigeration" };
  }
  if (amenity === "ice_cream" || ["alcohol", "beverages"].includes(shop)) {
    return { service_line: "refrigeration" as const, score: 66, reason: "walk-in coolers, freezers, and display refrigeration" };
  }
  if (["cafe", "bar", "pub"].includes(amenity) || shop === "bakery") {
    return { service_line: "kitchen_equipment" as const, score: 64, reason: "commercial kitchen and HVAC demand" };
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
  // Professional/commercial HVAC buyers (from the Google searches).
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
  else { score += 4; notes.push("independent business (local owner decides on vendors)"); }
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
  const around = `(around:${area.radiusM},${area.lat},${area.lon})`;
  const query = `
[out:json][timeout:25];
(
  nwr["amenity"~"^(restaurant|fast_food|cafe|bar|pub|food_court|ice_cream|nursing_home)$"]${around};
  nwr["shop"~"^(supermarket|convenience|bakery|butcher|seafood|deli|alcohol|beverages|florist)$"]${around};
  nwr["tourism"~"^(hotel|motel)$"]${around};
);
out tags center 600;
`;
  const payload = await fetchOverpass(query, deadline);
  return leadsFromElements(payload.elements ?? [], area, new Date().toISOString(), skipNames);
}

// Which area a run starts with: the cron moves one area forward each day; a manual
// scan starts somewhere different each time so repeated presses keep finding more.
export function startAreaIndex(mode: "daily" | "manual", now = new Date()) {
  if (mode === "daily") return Math.floor(now.getTime() / 86400000) % SCAN_AREAS.length;
  return Math.floor(Math.random() * SCAN_AREAS.length);
}

type Client = ReturnType<typeof createServiceRoleClient>;
export type LeadScanResult = { added: number; scanned: string[]; skippedCustomers: number; source: "google" | "openstreetmap" };

// Business names already in Revenue Radar, so a business found again through a
// different source (Google vs OpenStreetMap) isn't added twice.
async function existingProspectNames(client: Client) {
  const names = new Set<string>();
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await client.from("chillbros_revenue_prospects").select("business_name").range(from, from + 999);
    for (const row of (data ?? []) as { business_name: string | null }[]) names.add(nameKey(row.business_name ?? ""));
    if (!data || data.length < 1000) break;
  }
  return names;
}

// Scans areas in rotation until about `target` new leads are added (max `maxAreas`
// areas, to stay polite to the free map service). Duplicates are ignored by the
// database's normalized_key and by business name, so only genuinely new businesses
// count. Stops starting new searches once `budgetMs` is used, so the run always
// finishes and saves what it found instead of being killed by the platform timeout.
export async function runLeadScan(client: Client, options: { mode: "daily" | "manual"; actorId: string | null; target?: number; maxAreas?: number; budgetMs?: number }): Promise<LeadScanResult> {
  const target = options.target ?? 25;
  const maxAreas = Math.min(options.maxAreas ?? 3, SCAN_AREAS.length);
  const deadline = Date.now() + (options.budgetMs ?? 50000);
  const googleKey = String(process.env.GOOGLE_PLACES_API_KEY || "").trim();
  const { data: customers } = await client.from("chillbros_customers").select("name").limit(5000);
  const customerNames = new Set((customers ?? []).map((c: { name: string | null }) => nameKey(c.name ?? "")).filter((n) => n.length > 2));
  const knownNames = await existingProspectNames(client);

  const start = startAreaIndex(options.mode);
  const result: LeadScanResult = { added: 0, scanned: [], skippedCustomers: 0, source: googleKey ? "google" : "openstreetmap" };
  let lastError: Error | null = null;
  // Google: rotate the business-type searches too, so each day asks something new.
  let queryIndex = start;
  for (let i = 0; i < maxAreas && result.added < target && timeLeft(deadline) > 8000; i++) {
    const area = SCAN_AREAS[(start + i) % SCAN_AREAS.length];
    let all: DiscoveredRevenueLead[] = [];
    try {
      if (googleKey) {
        const now = new Date().toISOString();
        for (let q = 0; q < 3 && timeLeft(deadline) > 8000; q++) {
          const places = await searchGooglePlaces(googleKey, GOOGLE_QUERIES[queryIndex++ % GOOGLE_QUERIES.length], area, deadline);
          all.push(...leadsFromGooglePlaces(places, area, now));
        }
      } else {
        all = await discoverAreaLeads(area, new Set(), deadline);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Lead discovery failed.");
      if (!all.length) continue;
    }
    const leads = all.filter((lead) => !customerNames.has(nameKey(lead.business_name)));
    result.skippedCustomers += all.length - leads.length;
    result.scanned.push(area.name);
    const fresh = leads.filter((lead) => {
      const key = nameKey(lead.business_name);
      if (knownNames.has(key)) return false;
      knownNames.add(key);
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
