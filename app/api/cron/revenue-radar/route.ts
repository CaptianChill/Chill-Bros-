import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { runLeadScan } from "@/lib/chillbros/revenue-discovery";

export const dynamic = "force-dynamic";
// The scan stops starting new searches after ~4 minutes so it always saves and reports.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = String(process.env.CRON_SECRET || "");
  if (!secret) {
    return Response.json({ ok: false, error: "Cron secret is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const client = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data: overdueRows, error: overdueError } = await client
    .from("chillbros_revenue_tasks")
    .update({ status: "overdue", updated_at: now })
    .lt("due_at", now)
    .in("status", ["open", "in_progress"])
    .select("id");

  // The Sales Command tables are deployed additively. Until that migration is
  // promoted, the legacy lead scan must continue working without interruption.
  const missingSalesSchema = overdueError && ["PGRST205", "42P01"].includes(String(overdueError.code || ""));
  if (overdueError && !missingSalesSchema) console.error("[revenue-radar-cron] overdue task update failed", overdueError);

  // One area per quarter hour limits load on public sources while covering the
  // full region every four hours. Discovery never invokes outreach.
  try {
    const scan = await runLeadScan(client, { mode: "scheduled", actorId: null, target: 25, maxAreas: 1, budgetMs: 90000 });
    console.log("[revenue-radar-cron]", JSON.stringify(scan));
    return Response.json({ ok: true, added: scan.added, source: scan.source, areas: scan.scanned, skippedCustomers: scan.skippedCustomers, tasksMarkedOverdue: overdueRows?.length ?? 0, ranAt: now });
  } catch (error) {
    console.error("[revenue-radar-cron] lead scan failed", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Lead scan failed.", tasksMarkedOverdue: overdueRows?.length ?? 0 }, { status: 500 });
  }
}
