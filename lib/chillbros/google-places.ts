import "server-only";

// Google Places (Maps Platform) as a TRANSIENT lookup only.
//
// Google's terms forbid storing or caching Places content (name, phone, address,
// rating, hours, business status, ...) other than the place_id, and forbid reselling
// it or putting it in our products (lead packs). So this module asks Google only for
// the place_id, the listed website and whether the place is operating, and callers:
//   - use the result in memory to find the business's OWN website,
//   - fetch that website and persist only what the business publishes there,
//   - may persist the place_id (and the website URL, which is the business's own domain).
// Revenue Radar discovery (chillbros_revenue_prospects, which feeds the lead packs)
// must never call this. scripts/revenue-discovery.test.cjs enforces that.

export type TransientPlace = {
  /** Google place_id: the only Places field we are allowed to store. */
  id: string;
  /** Google's display name. Use only to match/filter in memory; never persist. */
  name: string;
  /** Listed website: only used to visit the business's own site. */
  website: string | null;
  /** Used only to skip closed businesses in memory; never persist. */
  operational: boolean;
};

// Deliberately no phone, address, rating or hours in the field mask: we can't keep
// them, so we never ask for them.
export const PLACES_FIELD_MASK = "places.id,places.displayName,places.websiteUri,places.businessStatus";

type Bias = { lat: number; lon: number; radiusM: number };

export async function searchPlacesTransient(apiKey: string, textQuery: string, opts: { pageSize?: number; bias?: Bias; timeoutMs?: number } = {}): Promise<TransientPlace[]> {
  const timeoutMs = opts.timeoutMs ?? 12000;
  if (timeoutMs < 3000) throw new Error("out of time");
  const body: Record<string, unknown> = { textQuery, pageSize: opts.pageSize ?? 20 };
  if (opts.bias) body.locationBias = { circle: { center: { latitude: opts.bias.lat, longitude: opts.bias.lon }, radius: Math.min(50000, opts.bias.radiusM) } };
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey, "x-goog-fieldmask": PLACES_FIELD_MASK },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    console.warn("[google-places] search failed", response.status, (await response.text().catch(() => "")).slice(0, 300));
    throw new Error(`Google Places returned ${response.status}.`);
  }
  const payload = (await response.json()) as { places?: { id?: string; displayName?: { text?: string }; websiteUri?: string; businessStatus?: string }[] };
  // Copy only the fields above, so nothing else Google returns can leak into a save.
  return (payload.places ?? [])
    .filter((p) => p.id && p.displayName?.text)
    .map((p) => ({ id: String(p.id), name: String(p.displayName?.text), website: p.websiteUri ? String(p.websiteUri) : null, operational: !p.businessStatus || p.businessStatus === "OPERATIONAL" }));
}

/** The stored reference to a place: just its place_id, in a URL staff can open. */
export const placeIdUrl = (placeId: string) => `https://www.google.com/maps/place/?q=place_id:${placeId}`;
