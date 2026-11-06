// Contractor BUYERS for the lead packs, from free public Texas license lists (pure parsing, unit-tested).
// The leadbiz cron fetches these daily into chillbros_leadbiz_contractors. Kept in step with
// sites/new-openings/lib/buyers.ts (that site is standalone and has its own copy).
//  - Electricians, sign companies: TDLR "All Licenses" on data.texas.gov
//  - Plumbers: TSBPE Responsible Master Plumber list (each plumbing company must have one)
//  - Pest control: TDA Structural Pest Control commercial business list (no phone in the file)
export type Trade = "Electricians" | "Sign companies" | "Plumbers" | "Pest control" | "HVAC & refrigeration";
export type Buyer = { name: string; trade: Trade; phone: string; address: string; license: string; contact?: string; source?: string };

const COUNTIES = ["BEXAR", "COMAL", "GUADALUPE", "KENDALL", "MEDINA", "WILSON"];
const TDLR_TYPES: Record<string, Trade> = { "Electrical Contractor": "Electricians", "Electrical Sign Contractor": "Sign companies", "A/C Contractor": "HVAC & refrigeration" };
// A/C contractors: Class A only (unlimited tonnage, the commercial-size license). The state file has no phones for them.
const isClassA = (subtype: string) => /^A/.test(subtype || "");

export const fmtPhone = (p: string) => { const d = String(p ?? "").replace(/\D/g, "").slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : ""; };

/** Minimal RFC-4180 CSV parser (quoted fields, doubled quotes, CRLF). Returns rows keyed by trimmed header. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); if (row.some((v) => v !== "")) rows.push(row); }
  const [head, ...body] = rows;
  if (!head) return [];
  const keys = head.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, String(r[i] ?? "").trim()])));
}

const title = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Llc|Inc|Lp|Ltd|Co)\b/g, (m) => m.toUpperCase());

export function plumbersFrom(rows: Record<string, string>[]): Buyer[] {
  return rows.filter((r) => r.LIC_STATUS === "Current" && COUNTIES.includes(String(r.COUNTY).toUpperCase()) && r.PLUMB_COMPANY)
    .map((r) => ({
      name: r.PLUMB_COMPANY, trade: "Plumbers" as const, phone: fmtPhone(r.PHONE), license: `RMP-${r.LICENSE_NBR}`,
      address: [r.ADDR1, [r.CITY, r.ZIP].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      contact: title([r.FIRST_NAME, r.LAST_NAME].filter(Boolean).join(" ")),
    }));
}

export function pestFrom(rows: Record<string, string>[]): Buyer[] {
  return rows.filter((r) => COUNTIES.includes(String(r.COUNTY).toUpperCase()) && /[PT]/.test(r.CATEGORIES ?? "") && (r.DBA || r.LEGAL_BUSINESS_NAME))
    .map((r) => ({
      name: r.DBA || r.LEGAL_BUSINESS_NAME, trade: "Pest control" as const, phone: "", license: `TPCL-${r.TPCL}`,
      address: `${title(r.COUNTY)} County`, contact: title(r.OPERATOR || r.RESPONSIBLE_APPLICATOR || ""),
    }));
}

export function tdlrFrom(rows: Record<string, string>[]): Buyer[] {
  return rows.filter((r) => r.license_type !== "A/C Contractor" || isClassA(r.license_subtype)).map((r) => ({
    name: String(r.business_name || "").trim(), trade: TDLR_TYPES[r.license_type], phone: fmtPhone(r.business_telephone || r.owner_telephone || ""),
    address: [r.business_address_line1, r.business_city_state_zip].filter(Boolean).join(", ") || (r.business_county ? `${title(r.business_county)} County` : ""), license: r.license_number,
    contact: r.license_type === "A/C Contractor" ? title(r.owner_name || "") : undefined,
  })).filter((b) => b.name && b.trade && (b.phone || b.trade === "HVAC & refrigeration"));
}

/** One row per company per trade (same name + phone, or same name when there's no phone). */
export function dedupe(list: Buyer[]) {
  const seen = new Set<string>();
  return list.filter((b) => { const k = `${b.trade}|${b.name.toLowerCase().replace(/[^a-z0-9]/g, "")}|${b.phone}`; return seen.has(k) ? false : (seen.add(k), true); });
}

async function getText(url: string) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.text();
}

const SOURCES: Record<string, () => Promise<Buyer[]>> = {
  tdlr: async () => {
    const where = `business_county in (${COUNTIES.map((c) => `'${c}'`).join(",")}) AND license_type in (${Object.keys(TDLR_TYPES).map((t) => `'${t}'`).join(",")})`;
    const url = `https://data.texas.gov/resource/7358-krk7.json?$select=business_name,license_type,license_subtype,owner_name,business_county,business_telephone,owner_telephone,business_address_line1,business_city_state_zip,license_number&$where=${encodeURIComponent(where)}&$limit=5000`;
    return tdlrFrom(JSON.parse(await getText(url)));
  },
  tsbpe: async () => plumbersFrom(parseCsv(await getText("https://tsbpe.texas.gov/download-csv/RMP/"))),
  tda: async () => pestFrom(parseCsv(await getText("https://texasagriculture.gov/Portals/0/Reports/PIR/spcs_commercial_business.csv"))),
};

/** Fetches every state list. Failed sources are reported, not thrown, so one outage keeps the rest. */
export async function fetchAllLicenses() {
  const out: Buyer[] = [];
  const failed: string[] = [];
  for (const [name, load] of Object.entries(SOURCES)) {
    try { out.push(...(await load()).map((b) => ({ ...b, source: name }))); }
    catch { failed.push(name); }
  }
  return { buyers: dedupe(out), failed };
}
