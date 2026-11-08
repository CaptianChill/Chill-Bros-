import { runLeadbizOutreach } from "@/lib/chillbros/leadbiz/runner";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Hourly (vercel.json). Finds San Antonio contractor buyers for the lead business, looks up
// their published email, and sends the lead-pack offer every day 9am–5pm Central (capped daily).
export async function GET(request: Request) {
  const secret = String(process.env.CRON_SECRET || "");
  if (!secret) return Response.json({ ok: false, error: "Cron secret is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const run = await runLeadbizOutreach(createServiceRoleClient());
    console.log("[leadbiz]", JSON.stringify(run));
    return Response.json({ ok: true, ...run });
  } catch (error) {
    console.error("[leadbiz] run failed", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Run failed." }, { status: 500 });
  }
}
