import { createHash, timingSafeEqual } from "node:crypto";
import { readSheet } from "read-excel-file/node";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { cityEstablishments, isCityReportUrl, MAX_REPORT_BYTES } from "@/lib/chillbros/revenue-city-source";
import { saveCityEstablishments } from "@/lib/chillbros/revenue-discovery";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Most new businesses Revenue Radar takes from one city report, so the office review queue isn't flooded.
const MAX_ADDED_PER_REPORT = 100;

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * POST /api/cron/radar-city-import — the owner's PC sends the City of San Antonio food-establishment report here.
 * The city's site blocks cloud servers (HTTP 403), so the PC (home internet) downloads the official .xlsx and posts
 * its bytes with the report's URL in `X-Report-Url`. Bearer `RADAR_PC_SECRET`. Discovery only: never sends outreach.
 */
export async function POST(request: Request) {
  const secret = String(process.env.RADAR_PC_SECRET || "").trim();
  if (!secret) return Response.json({ ok: false, error: "PC city import is not configured." }, { status: 503 });
  if (!timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`))) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const reportUrl = String(request.headers.get("x-report-url") || "").trim();
  if (!isCityReportUrl(reportUrl)) return Response.json({ ok: false, error: "X-Report-Url must be a current official sa.gov food-inspection report." }, { status: 400 });
  if (Number(request.headers.get("content-length")) > MAX_REPORT_BYTES) return Response.json({ ok: false, error: "Report is too large." }, { status: 413 });
  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_REPORT_BYTES) return Response.json({ ok: false, error: "Report is empty or too large." }, { status: 413 });
  // An .xlsx is a zip file: it starts with "PK".
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return Response.json({ ok: false, error: "Not an .xlsx file." }, { status: 415 });

  try {
    const rows = await readSheet(bytes, 1);
    const businesses = cityEstablishments(rows, reportUrl);
    const result = await saveCityEstablishments(createServiceRoleClient(), businesses, { actorId: null, target: MAX_ADDED_PER_REPORT });
    console.log("[radar-city-import]", JSON.stringify({ report: reportUrl, inReport: businesses.length, ...result }));
    return Response.json({ ok: true, report: reportUrl, inReport: businesses.length, added: result.added, skippedCustomers: result.skippedCustomers });
  } catch (error) {
    console.error("[radar-city-import] failed", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Import failed." }, { status: 500 });
  }
}
