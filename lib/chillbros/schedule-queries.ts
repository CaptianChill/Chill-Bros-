import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type { DispatchJob } from "./operations-queries";
import type { JobStatus } from "./types";

export async function getCalendarJobs(): Promise<DispatchJob[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("chillbros_jobs")
    .select("id, customer_id, assigned_tech_id, status, location, scope, work_performed, scheduled_window, created_at, customer:chillbros_customers(name), tech:chillbros_profiles(full_name)")
    .in("status", ["scheduled", "in_progress"])
    .is("archived_at", null)
    .not("scheduled_window", "is", null)
    .order("scheduled_window", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    const tech = Array.isArray(row.tech) ? row.tech[0] : row.tech;
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: customer?.name ?? "Unknown customer",
      assignedTechId: row.assigned_tech_id,
      assignedTechName: tech?.full_name ?? null,
      status: row.status as JobStatus,
      location: row.location,
      scope: row.scope,
      workPerformed: row.work_performed,
      scheduledWindow: row.scheduled_window,
      createdAt: row.created_at,
      workflowStage: row.status,
    };
  });
}
