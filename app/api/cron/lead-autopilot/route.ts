import { runAutopilot } from "@/lib/chillbros/autopilot/engine";

export const dynamic = "force-dynamic";
// Website checks + AI-written emails for one 15-minute batch.
export const maxDuration = 300;

// Every 15 minutes, around the clock (vercel.json). Each lane decides whether
// this hour is its best window; see lib/chillbros/autopilot/timing.ts.
export async function GET(request: Request) {
  const secret = String(process.env.CRON_SECRET || "");
  if (!secret) return Response.json({ ok: false, error: "Cron secret is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const run = await runAutopilot();
    console.log("[lead-autopilot]", JSON.stringify(run));
    return Response.json({ ok: true, ...run });
  } catch (error) {
    console.error("[lead-autopilot] run failed", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Run failed." }, { status: 500 });
  }
}
