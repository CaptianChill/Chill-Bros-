import "server-only";

// Contractor BUYERS for the lead packs, from Texas TDLR's public license data (data.texas.gov,
// free public records). Fetched live; nothing is stored. Only TDLR-licensed trades are here
// (electrical, electrical sign); plumbing, pest and security are licensed by other agencies.
export type Buyer = { name: string; trade: "Electricians" | "Sign companies"; phone: string; address: string; license: string };

const COUNTIES = ["BEXAR", "COMAL", "GUADALUPE", "KENDALL", "MEDINA", "WILSON"];
const TYPES: Record<string, Buyer["trade"]> = { "Electrical Contractor": "Electricians", "Electrical Sign Contractor": "Sign companies" };

const fmt = (p: string) => { const d = p.replace(/\D/g, "").slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : ""; };

export async function loadBuyers(): Promise<Buyer[]> {
  const where = `business_county in (${COUNTIES.map((c) => `'${c}'`).join(",")}) AND license_type in (${Object.keys(TYPES).map((t) => `'${t}'`).join(",")})`;
  const url = `https://data.texas.gov/resource/7358-krk7.json?$select=business_name,license_type,business_telephone,owner_telephone,business_address_line1,business_city_state_zip,license_number&$where=${encodeURIComponent(where)}&$limit=5000`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const rows = (await res.json()) as Record<string, string>[];
    const seen = new Set<string>();
    const out: Buyer[] = [];
    for (const r of rows) {
      const phone = fmt(r.business_telephone || r.owner_telephone || "");
      const name = String(r.business_name || "").trim();
      if (!phone || !name) continue;
      const key = `${name.toLowerCase()}|${phone}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, trade: TYPES[r.license_type], phone, address: [r.business_address_line1, r.business_city_state_zip].filter(Boolean).join(", "), license: r.license_number });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
