import "server-only";

import type { createServiceRoleClient } from "@/lib/supabase/service-client";

// When a customer approves a quote (signature or verbal yes), the sold work goes back
// on the dispatch board as Unassigned so office/owner can schedule it, keeping the same
// job and its notes, equipment, photos and history. A tech who is still on site keeps
// the job, so they can start it right away with Work Now.

export const APPROVED_NEEDS_SCHEDULING = "Approved · needs scheduling";

// Job states that mean nobody is working the call right now.
const WAITING_STATUSES = ["completed", "work_complete", "awaiting_approval", "approved", "parts_required", "return_visit_needed"];

export async function routeApprovedJob(supabase: ReturnType<typeof createServiceRoleClient>, jobId: string, now: string) {
  const { data } = await supabase
    .from("chillbros_jobs")
    .update({ status: "needs_scheduling", assigned_tech_id: null, scheduled_window: APPROVED_NEEDS_SCHEDULING, updated_at: now })
    .eq("id", jobId)
    .in("status", WAITING_STATUSES)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  return { movedToUnassigned: Boolean(data) };
}
