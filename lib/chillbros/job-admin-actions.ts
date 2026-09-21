"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

type Result = { ok: true } | { ok: false; error: string };
import { JOB_ACTIVE_STATUSES as ACTIVE_STATUSES } from "@/lib/chillbros/types";

async function requireOfficeOrManager() {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (!["manager", "office"].includes(profile.role)) return { ok: false as const, error: "Office or manager access required." };
  return { ok: true as const, profile };
}

function refresh(jobId?: string, customerId?: string) {
  for (const path of ["/dispatch", "/office", "/manager", "/crm", "/technician", "/"]) revalidatePath(path);
  if (customerId) revalidatePath(`/customers/${customerId}`);
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

export async function closeCallAction(jobId: string): Promise<Result> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  const supabase = createServiceRoleClient();
  const { data: job, error: readError } = await supabase.from("chillbros_jobs").select("id,customer_id,status,archived_at").eq("id", jobId).maybeSingle();
  if (readError || !job || job.archived_at) return { ok: false, error: "Call is unavailable." };
  if (job.status === "completed") return { ok: true };
  if (!ACTIVE_STATUSES.includes(job.status as (typeof ACTIVE_STATUSES)[number])) return { ok: false, error: `Cannot close a call with current status "${job.status}".` };

  const { data: updated, error } = await supabase
    .from("chillbros_jobs")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .is("archived_at", null)
    .in("status", [...ACTIVE_STATUSES])
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "This call changed before it could be closed. Refresh and review it first." };

  const message = "Office closed the service call as completed.";
  await Promise.all([
    supabase.from("chillbros_workflow_events").insert({ job_id: jobId, actor_id: guard.profile.id, stage: "office_closed", message }),
    supabase.from("chillbros_customer_service_history").insert({ customer_id: job.customer_id, note: message }),
  ]);
  refresh(jobId, job.customer_id);
  return { ok: true };
}

export async function reassignJobTechnicianAction(jobId: string, technicianId: string): Promise<Result> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  const supabase = createServiceRoleClient();
  const { data: job, error: readError } = await supabase.from("chillbros_jobs").select("id,customer_id,status,archived_at").eq("id", jobId).maybeSingle();
  if (readError || !job || job.archived_at) return { ok: false, error: "Call is unavailable." };
  if (!ACTIVE_STATUSES.includes(job.status as (typeof ACTIVE_STATUSES)[number])) return { ok: false, error: `Cannot dispatch a call with current status "${job.status}".` };

  const techId = technicianId.trim() || null;
  if (techId) {
    const { data: tech } = await supabase.from("chillbros_profiles").select("id,role,status").eq("id", techId).maybeSingle();
    if (!tech || tech.status !== "active" || !["technician", "manager"].includes(tech.role)) return { ok: false, error: "Choose an active technician." };
  }

  const { error } = await supabase.from("chillbros_jobs").update({ assigned_tech_id: techId, updated_at: new Date().toISOString() }).eq("id", jobId);
  if (error) return { ok: false, error: error.message };
  await supabase.from("chillbros_workflow_events").insert({ job_id: jobId, actor_id: guard.profile.id, stage: "reassigned", message: techId ? `${guard.profile.fullName} dispatched this call.` : `${guard.profile.fullName} unassigned this call.` });
  refresh(jobId, job.customer_id);
  return { ok: true };
}

export async function cancelCallAction(jobId: string): Promise<Result> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  const supabase = createServiceRoleClient();
  const { data: job, error: readError } = await supabase.from("chillbros_jobs").select("id,customer_id,status,archived_at").eq("id", jobId).maybeSingle();
  if (readError || !job || job.archived_at) return { ok: false, error: "Call is unavailable." };
  if (job.status === "cancelled") return { ok: true };
  if (!ACTIVE_STATUSES.includes(job.status as (typeof ACTIVE_STATUSES)[number])) return { ok: false, error: `Cannot cancel a call with current status "${job.status}".` };

  const { data: updated, error } = await supabase
    .from("chillbros_jobs")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .is("archived_at", null)
    .in("status", [...ACTIVE_STATUSES])
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "This call changed before it could be cancelled. Refresh and review it first." };

  const message = "Office cancelled the service call.";
  await Promise.all([
    supabase.from("chillbros_workflow_events").insert({ job_id: jobId, actor_id: guard.profile.id, stage: "office_cancelled", message }),
    supabase.from("chillbros_customer_service_history").insert({ customer_id: job.customer_id, note: message }),
  ]);
  refresh(jobId, job.customer_id);
  return { ok: true };
}

export async function archiveUnusedCallAction(jobId: string): Promise<Result> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  const supabase = createServiceRoleClient();
  const { data: job, error: readError } = await supabase
    .from("chillbros_jobs")
    .select("id,customer_id,status,work_performed,labor_hours,drive_hours,archived_at")
    .eq("id", jobId)
    .maybeSingle();
  if (readError || !job || job.archived_at) return { ok: false, error: "Call is unavailable." };
  if (!["scheduled", "cancelled"].includes(job.status)) return { ok: false, error: "Only unused scheduled or cancelled calls can be deleted from the board." };
  if ((job.work_performed ?? "").trim() || Number(job.labor_hours ?? 0) > 0 || Number(job.drive_hours ?? 0) > 0) return { ok: false, error: "This call has field work/time and must be closed or cancelled instead." };

  const [{ count: invoices }, { count: parts }, { count: photos }] = await Promise.all([
    supabase.from("chillbros_invoices").select("id", { count: "exact", head: true }).eq("job_id", jobId),
    supabase.from("chillbros_job_parts").select("id", { count: "exact", head: true }).eq("job_id", jobId),
    supabase.from("chillbros_job_photos").select("id", { count: "exact", head: true }).eq("job_id", jobId),
  ]);
  if ((invoices ?? 0) + (parts ?? 0) + (photos ?? 0) > 0) return { ok: false, error: "This call has estimate, part, or photo history and cannot be deleted. Cancel or close it instead." };

  const archivedAt = new Date().toISOString();
  const { error } = await supabase.from("chillbros_jobs").update({ status: "cancelled", archived_at: archivedAt, archived_by: guard.profile.id, archived_reason: "unused_call_removed", updated_at: archivedAt }).eq("id", jobId).is("archived_at", null);
  if (error) return { ok: false, error: error.message };
  await supabase.from("chillbros_customer_service_history").insert({ customer_id: job.customer_id, note: "Unused service call removed from the live dispatch board." });
  refresh(jobId, job.customer_id);
  return { ok: true };
}
