import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type { DispatchJob } from "./operations-queries";
import type { JobStatus } from "./types";

export async function getCalendarJobs(): Promise<DispatchJob[]> {
  const supabase = createServiceRoleClient();

  // Keep the calendar read deliberately simple. The previous joined query could fail as a
  // whole when a relationship was missing/ambiguous, which made the UI report 0 items even
  // though chillbros_jobs contained scheduled rows. Read jobs first, then hydrate names.
  const { data: jobs, error: jobsError } = await supabase
    .from("chillbros_jobs")
    .select("id, customer_id, assigned_tech_id, status, location, scope, work_performed, scheduled_window, created_at")
    .is("archived_at", null)
    .not("scheduled_window", "is", null)
    .order("created_at", { ascending: true });

  if (jobsError || !jobs) {
    console.error("[schedule] calendar job read failed", jobsError);
    return [];
  }

  const visibleJobs = jobs.filter((row) => String(row.scheduled_window ?? "").trim().length > 0 && row.status !== "cancelled");
  const customerIds = [...new Set(visibleJobs.map((row) => row.customer_id).filter(Boolean))];
  const techIds = [...new Set(visibleJobs.map((row) => row.assigned_tech_id).filter(Boolean))];

  const customerNames = new Map<string, string>();
  const techNames = new Map<string, string>();

  if (customerIds.length) {
    const { data, error } = await supabase.from("chillbros_customers").select("id,name").in("id", customerIds);
    if (error) console.error("[schedule] customer hydration failed", error);
    for (const row of data ?? []) customerNames.set(row.id, row.name);
  }

  if (techIds.length) {
    const { data, error } = await supabase.from("chillbros_profiles").select("id,full_name").in("id", techIds);
    if (error) console.error("[schedule] technician hydration failed", error);
    for (const row of data ?? []) techNames.set(row.id, row.full_name);
  }

  return visibleJobs.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: customerNames.get(row.customer_id) ?? "Unknown customer",
    assignedTechId: row.assigned_tech_id,
    assignedTechName: row.assigned_tech_id ? techNames.get(row.assigned_tech_id) ?? null : null,
    status: row.status as JobStatus,
    location: row.location,
    scope: row.scope,
    workPerformed: row.work_performed,
    scheduledWindow: row.scheduled_window,
    createdAt: row.created_at,
    workflowStage: row.status,
  }));
}
