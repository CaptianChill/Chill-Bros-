import { rejectUnlessBrae, noStore } from "@/lib/brae/auth";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { JOB_ACTIVE_STATUSES, JOB_STATUS_LABELS, type JobStatus } from "@/lib/chillbros/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/brae/unassigned
 * Open jobs with no technician assigned (the Unassigned Work queue). Read-only.
 */
export async function GET(request: Request) {
  const denied = rejectUnlessBrae(request);
  if (denied) return denied;

  const supabase = createServiceRoleClient();
  const { data: jobs, error } = await supabase
    .from("chillbros_jobs")
    .select("id, customer_id, status, location, scope, scheduled_window, created_at")
    .is("archived_at", null)
    .is("assigned_tech_id", null)
    .in("status", JOB_ACTIVE_STATUSES)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return Response.json({ ok: false, error: "Could not read jobs." }, { status: 500 });

  const customerIds = [...new Set((jobs ?? []).map((row) => row.customer_id).filter(Boolean))];
  const names = new Map<string, string>();
  if (customerIds.length) {
    const { data } = await supabase.from("chillbros_customers").select("id,name").in("id", customerIds);
    for (const row of data ?? []) names.set(row.id, row.name);
  }

  const rows = (jobs ?? []).map((row) => ({
    jobId: row.id,
    customer: names.get(row.customer_id) ?? "Unknown customer",
    status: JOB_STATUS_LABELS[row.status as JobStatus] ?? row.status,
    location: row.location,
    scope: row.scope,
    scheduledWindow: row.scheduled_window,
    createdAt: row.created_at,
  }));

  return Response.json({ ok: true, count: rows.length, jobs: rows }, noStore);
}
