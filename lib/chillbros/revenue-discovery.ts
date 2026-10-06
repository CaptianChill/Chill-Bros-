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

async function fetchOverpass(query: string): Promise<OverpassPayload> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          "user-agent": "ChillBros-RevenueRadar/1.2",
        },
        body: new URLSearchParams({ data: query }),
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as OverpassPayload;
      if (Array.isArray(payload.elements)) return payload;
    } catch {
      // Public Overpass instances can be overloaded or temporarily unreachable.
      // Try the next global instance before surfacing a failure to the user.
    }
  }
  throw new Error("Lead discovery sources are temporarily unavailable. Revenue Radar tried all configured discovery sources; try the scan again shortly.");
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

export async function discoverAreaLeads(area: ScanArea, skipNames: Set<string> = new Set()): Promise<DiscoveredRevenueLead[]> {
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
  const payload = await fetchOverpass(query);
  return leadsFromElements(payload.elements ?? [], area, new Date().toISOString(), skipNames);
}

// Which area a run starts with: the cron moves one area forward each day; a manual
// scan starts somewhere different each time so repeated presses keep finding more.
export function startAreaIndex(mode: "daily" | "manual", now = new Date()) {
  if (mode === "daily") return Math.floor(now.getTime() / 86400000) % SCAN_AREAS.length;
  return Math.floor(Math.random() * SCAN_AREAS.length);
}

type Client = ReturnType<typeof createServiceRoleClient>;
export type LeadScanResult = { added: number; scanned: string[]; skippedCustomers: number };

// Scans areas in rotation until about `target` new leads are added (max `maxAreas`
// searches, to stay polite to the free map service). Duplicates are ignored by the
// database's normalized_key, so only genuinely new businesses count.
export async function runLeadScan(client: Client, options: { mode: "daily" | "manual"; actorId: string | null; target?: number; maxAreas?: number }): Promise<LeadScanResult> {
  const target = options.target ?? 25;
  const maxAreas = Math.min(options.maxAreas ?? 3, SCAN_AREAS.length);
  const { data: customers } = await client.from("chillbros_customers").select("name").limit(5000);
  const customerNames = new Set((customers ?? []).map((c: { name: string | null }) => nameKey(c.name ?? "")).filter((n) => n.length > 2));

  const start = startAreaIndex(options.mode);
  const result: LeadScanResult = { added: 0, scanned: [], skippedCustomers: 0 };
  let lastError: Error | null = null;
  for (let i = 0; i < maxAreas && result.added < target; i++) {
    const area = SCAN_AREAS[(start + i) % SCAN_AREAS.length];
    let leads: DiscoveredRevenueLead[];
    try {
      const all = await discoverAreaLeads(area);
      leads = all.filter((lead) => !customerNames.has(nameKey(lead.business_name)));
      result.skippedCustomers += all.length - leads.length;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Lead discovery failed.");
      continue;
    }
    result.scanned.push(area.name);
    if (!leads.length) continue;
    const now = new Date().toISOString();
    const rows = leads.map((lead) => ({ ...lead, status: "new", created_by: options.actorId, updated_by: options.actorId, updated_at: now }));
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
