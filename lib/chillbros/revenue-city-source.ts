import "server-only";
import { readSheet } from "read-excel-file/node";

export const CITY_REPORT_PAGE = "https://www.sa.gov/Directory/Departments/SAMHD/Reports-Statistics/Food-Establishment-Inspections";
const MAX_REPORT_BYTES = 2_000_000;
export type CityEstablishment = { name: string; address: string; observedAt: string; sourceUrl: string };

export function latestCityReport(html: string, now = new Date()) {
  const candidates: { url: string; date: number }[] = [];
  for (const match of html.matchAll(/href=["']([^"']+\.xlsx)["']/gi)) {
    const url = new URL(match[1], CITY_REPORT_PAGE);
    if (url.origin !== "https://www.sa.gov") continue;
    const period = /\/samhd\/documents\/health-data-statistics\/fe\/(\d{4})\/(\d{2})(\d{2})-(\d{2})(\d{2})\.xlsx$/.exec(url.pathname);
    if (!period) continue;
    const year = Number(period[1]);
    const date = Date.UTC(year, Number(period[2]) - 1, Number(period[3]));
    if (date > now.getTime() || now.getTime() - date > 45 * 86400000) continue;
    candidates.push({ url: url.toString(), date });
  }
  return candidates.sort((a, b) => b.date - a.date)[0]?.url ?? null;
}

export function cityEstablishments(rows: unknown[][], report: string, now = new Date()): CityEstablishment[] {
  const header = rows[0]?.map(v => String(v ?? "").trim().toUpperCase());
  if (header?.[0] !== "ESTABLISHMENT NAME" || header?.[1] !== "ESTABLISHMENT ADDRESS" || header?.[2] !== "INSPECTION DATE") {
    throw new Error("City report schema changed; discovery stopped rather than guessing fields.");
  }
  return rows.slice(1).flatMap((row, index) => {
    const name = String(row[0] ?? "").trim();
    const address = String(row[1] ?? "").trim();
    // Excel serial dates are accepted only in the published inspection-date column.
    const date = row[2] instanceof Date ? row[2] : typeof row[2] === "number" ? new Date((row[2] - 25569) * 86400000) : null;
    if (!name || !/San Antonio,?\s+TX\b/i.test(address) || !date || !Number.isFinite(date.getTime())) return [];
    if (date.getTime() > now.getTime() + 86400000 || now.getTime() - date.getTime() > 90 * 86400000) return [];
    return [{ name, address, observedAt: date.toISOString(), sourceUrl: `${report}#row-${index + 2}` }];
  });
}

async function publicResponse(url: string, deadline: number) {
  const budget = Math.min(12000, deadline - Date.now() - 2000);
  if (budget < 1000) throw new Error("City discovery budget exhausted.");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(budget), next: { revalidate: 3600 } });
  if (!response.ok) throw new Error(`City report source returned ${response.status}.`);
  return response;
}

export async function discoverCityEstablishments(deadline: number): Promise<CityEstablishment[]> {
  const index = await publicResponse(CITY_REPORT_PAGE, deadline);
  const html = await index.text();
  if (html.length > MAX_REPORT_BYTES) throw new Error("City report index exceeded size limit.");
  const url = latestCityReport(html);
  if (!url) throw new Error("No current official city report is available.");
  const response = await publicResponse(url, deadline);
  if (Number(response.headers.get("content-length")) > MAX_REPORT_BYTES) throw new Error("City report exceeded size limit.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_REPORT_BYTES) throw new Error("City report exceeded size limit.");
  const rows = await readSheet(bytes, 1);
  const businesses = cityEstablishments(rows, url);
  if (!businesses.length) throw new Error("City report had no valid current local establishments.");
  return businesses;
}
