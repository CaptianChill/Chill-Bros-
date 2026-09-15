import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { JOB_ACTIVE_STATUSES, type JobStatus } from "./types";
import type { DispatchJob } from "./operations-queries";

const FIELD_VISIBLE = ["scheduled", "in_progress", "dispatched", "en_route", "arrived", "diagnosing", "awaiting_approval", "approved", "parts_required", "return_visit_needed", "repairing", "work_complete", "ready_to_invoice"] as const;

type NamedRelation = { name: string | null };
type TechnicianRelation = { full_name: string | null };
type TechnicianJobRecord = {
  id: string;
  customer_id: string;
  assigned_tech_id: string | null;
  status: JobStatus;
  location: string | null;
  scope: string | null;
  work_performed: string | null;
  scheduled_window: string | null;
  created_at: string;
  customer: NamedRelation | NamedRelation[] | null;
  tech: TechnicianRelation | TechnicianRelation[] | null;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getAssignedFieldJobsForTechnician(profile: { id: string }, limit = 250): Promise<DispatchJob[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("chillbros_jobs")
    .select("id,customer_id,assigned_tech_id,status,location,scope,work_performed,scheduled_window,created_at,customer:chillbros_customers(name),tech:chillbros_profiles!chillbros_jobs_assigned_tech_id_fkey(full_name)")
    .eq("assigned_tech_id", profile.id)
    .in("status", FIELD_VISIBLE as unknown as string[])
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error(`[technician-queue] lookup failed profile=${profile.id}`, error);
    return [];
  }

  const jobs = data as unknown as TechnicianJobRecord[];
  console.info(`[technician-queue] profile=${profile.id} jobs=${jobs.length}`);

  return jobs
    .filter((record) => JOB_ACTIVE_STATUSES.includes(record.status))
    .map((record) => ({
      id: record.id,
      customerId: record.customer_id,
      customerName: first(record.customer)?.name ?? "Unknown customer",
      assignedTechId: record.assigned_tech_id,
      assignedTechName: first(record.tech)?.full_name ?? null,
      status: record.status,
      location: record.location,
      scope: record.scope,
      workPerformed: record.work_performed,
      scheduledWindow: record.scheduled_window,
      createdAt: record.created_at,
      workflowStage: record.status,
    }));
}
