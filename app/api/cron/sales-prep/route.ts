import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { runSalesPrep } from "@/lib/chillbros/sales-prep";

export const dynamic = "force-dynamic";
// Places lookups, website checks and AI battle cards for one batch.
export const maxDuration = 300;

// Every 10 minutes (vercel.json) until every open lead is sales-ready; then it idles.
export async function GET(request: Request) {
  const secret = String(process.env.CRON_SECRET || "");
  if (!secret) return Response.json({ ok: false, error: "Cron secret is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const run = await runSalesPrep(createServiceRoleClient());
    console.log("[sales-prep]", JSON.stringify(run));
    return Response.json({ ok: true, ...run });
  } catch (error) {
    console.error("[sales-prep] run failed", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Run failed." }, { status: 500 });
  }
}
