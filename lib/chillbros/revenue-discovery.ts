import "server-only";

import { normalizedKey } from "@/lib/chillbros/revenue-radar";

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

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
] as const;

async function fetchOverpass(query: string): Promise<OverpassPayload> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          "user-agent": "ChillBros-RevenueRadar/1.1",
        },
        body: new URLSearchParams({ data: query }),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as OverpassPayload;
      if (Array.isArray(payload.elements)) return payload;
    } catch {
      // Public Overpass instances can be overloaded or temporarily unreachable.
      // Try the next global instance before surfacing a failure to the user.
    }
  }
  throw new Error("Lead discovery sources are temporarily unavailable. Revenue Radar tried its backup source too; try the scan again shortly.");
}

function serviceFit(tags: Record<string, string>) {
  const amenity = tags.amenity ?? "";
  const shop = tags.shop ?? "";
  const tourism = tags.tourism ?? "";

  if (["supermarket", "convenience", "butcher", "seafood"].includes(shop)) {
    return { service_line: "refrigeration" as const, score: 72, reason: "refrigeration-heavy retail" };
  }
  if (["restaurant", "fast_food", "food_court"].includes(amenity)) {
    return { service_line: "multiple" as const, score: 70, reason: "commercial cooking, refrigeration, ice, and HVAC demand" };
  }
  if (["cafe", "bar", "pub"].includes(amenity) || shop === "bakery") {
    return { service_line: "kitchen_equipment" as const, score: 64, reason: "commercial kitchen and HVAC demand" };
  }
  if (tourism === "hotel") {
    return { service_line: "hvac_r" as const, score: 62, reason: "high HVAC runtime and guest-comfort exposure" };
  }
  return { service_line: "hvac_r" as const, score: 48, reason: "commercial HVAC demand" };
}

function addressFrom(tags: Record<string, string>) {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const locality = [tags["addr:city"], tags["addr:state"], tags["addr:postcode"]].filter(Boolean).join(", ");
  return [street, locality].filter(Boolean).join(", ") || null;
}

export async function discoverSanAntonioRevenueLeads(limit = 60): Promise<DiscoveredRevenueLead[]> {
  const query = `
[out:json][timeout:25];
(
  nwr["amenity"~"^(restaurant|fast_food|cafe|bar|pub|food_court)$"](around:25000,29.4241,-98.4936);
  nwr["shop"~"^(supermarket|convenience|bakery|butcher|seafood)$"](around:25000,29.4241,-98.4936);
  nwr["tourism"="hotel"](around:25000,29.4241,-98.4936);
);
out tags center ${Math.max(20, Math.min(limit * 3, 180))};
`;

  const payload = await fetchOverpass(query);
  const now = new Date().toISOString();
  const leads: DiscoveredRevenueLead[] = [];

  for (const element of payload.elements ?? []) {
    const tags = element.tags ?? {};
    const name = (tags.name || tags.brand || tags.operator || "").trim();
    if (!name || name.length < 2) continue;

    const fit = serviceFit(tags);
    const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
    const phone = tags.phone || tags["contact:phone"] || null;
    const email = tags.email || tags["contact:email"] || null;
    const address = addressFrom(tags);

    leads.push({
      business_name: name.slice(0, 200),
      city: "San Antonio",
      category: "other",
      service_line: fit.service_line,
      signal_summary: `Automatically discovered commercial prospect. Business type indicates ${fit.reason}. Revenue Radar found this lead without manual entry; office review is still required before outreach.`,
      source_url: sourceUrl,
      signal_observed_at: now,
      signal_verified: false,
      normalized_key: normalizedKey(name, "San Antonio", "auto_discovery", sourceUrl),
      score: fit.score,
      business_address: address,
      contact_email: email,
      contact_phone: phone,
    });

    if (leads.length >= limit) break;
  }

  return leads;
}
