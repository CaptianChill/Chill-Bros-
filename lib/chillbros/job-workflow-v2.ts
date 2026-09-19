"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";
import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";
import { JOB_ACTIVE_STATUSES, JOB_STATUS_LABELS, type JobStatus } from "./types";

type Result = { ok: true } | { ok: false; error: string };

const TECHNICIAN_STATUSES: JobStatus[] = ["en_route", "arrived", "work_complete"];

const clean = (value: string | null | undefined, max: number) => {
  const s = String(value ?? "").trim();
  return s ? s.slice(0, max) : null;
};

function refreshJobs() {
  for (const path of ["/technician", "/dispatch", "/manager", "/office", "/crm", "/invoices", "/customers", "/"]) revalidatePath(path);
}

export async function updateTechnicianJobV2Action(input: {
  jobId: string;
  status?: JobStatus;
  workPerformed?: string;
  laborHours?: number;
  driveHours?: number;
}): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["technician", "manager"].includes(profile.role)) return { ok: false, error: "Technician or manager access required." };

  const labor = Number(input.laborHours ?? 0);
  const drive = Number(input.driveHours ?? 0);
  if (!Number.isFinite(labor) || labor < 0 || labor > 24 || !Number.isFinite(drive) || drive < 0 || drive > 24) {
    return { ok: false, error: "Labor and drive hours must be between 0 and 24." };
  }

  const supabase = createServiceRoleClient();
  let jobQuery = supabase
    .from("chillbros_jobs")
    .select("id,customer_id,status,work_performed,labor_hours,drive_hours,assigned_tech_id")
    .eq("id", input.jobId);
  if (profile.role === "technician") jobQuery = jobQuery.eq("assigned_tech_id", profile.id);

  const { data: job } = await jobQuery.maybeSingle();
  if (!job) return { ok: false, error: profile.role === "manager" ? "Job not found." : "This job is not assigned to you." };
  if (!JOB_ACTIVE_STATUSES.includes(job.status as JobStatus)) return { ok: false, error: "This job is closed and locked from field edits." };

  const nextStatus = input.status ?? job.status as JobStatus;
  if (nextStatus !== job.status && !TECHNICIAN_STATUSES.includes(nextStatus)) return { ok: false, error: "Choose On my way, On site, or Work done." };
  const work = clean(input.workPerformed, 6000);
  let updateQuery = supabase
    .from("chillbros_jobs")
    .update({ status: nextStatus, work_performed: work, labor_hours: labor, drive_hours: drive, updated_at: new Date().toISOString() })
    .eq("id", input.jobId)
    .eq("status", job.status);
  if (profile.role === "technician") updateQuery = updateQuery.eq("assigned_tech_id", profile.id);

  const { data: updated, error } = await updateQuery.select("id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "This job changed while you were editing. Refresh before continuing." };

  const statusChanged = job.status !== nextStatus;
  const notesChanged = (job.work_performed ?? "") !== (work ?? "");
  if (statusChanged || notesChanged || Number(job.labor_hours) !== labor || Number(job.drive_hours) !== drive) {
    const actorLabel = profile.role === "manager" ? "Manager/owner" : "Technician";
    const message = statusChanged
      ? `${actorLabel} changed job status to ${JOB_STATUS_LABELS[nextStatus]}.`
      : `${actorLabel} service notes/time autosaved.`;

    await supabase.from("chillbros_workflow_events").insert({
      job_id: input.jobId,
      actor_id: profile.id,
      stage: `tech_${nextStatus}`,
      message,
    });

    if (statusChanged) {
      await supabase.from("chillbros_customer_service_history").insert({ customer_id: job.customer_id, note: message });
    }
  }

  refreshJobs();
  return { ok: true };
}

export async function updateDispatchJobV2Action(input: {
  jobId: string;
  assignedTechId?: string | null;
  status: JobStatus;
  location?: string;
  scope?: string;
  workPerformed?: string;
  scheduledWindow?: string;
}): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) return { ok: false, error: "Office or manager access required." };
  if (!JOB_ACTIVE_STATUSES.includes(input.status)) return { ok: false, error: "Use the close, cancel, or payment workflow for terminal statuses." };

  const supabase = createServiceRoleClient();
  const { data: job } = await supabase
    .from("chillbros_jobs")
    .select("id,customer_id,status,assigned_tech_id,location,scope,scheduled_window")
    .eq("id", input.jobId)
    .maybeSingle();
  if (!job) return { ok: false, error: "Job not found." };
  if (!JOB_ACTIVE_STATUSES.includes(job.status as JobStatus)) return { ok: false, error: "Closed and cancelled jobs are read-only." };

  if (input.assignedTechId) {
    const { data: tech } = await supabase
      .from("chillbros_profiles")
      .select("id")
      .eq("id", input.assignedTechId)
      .in("role", ["technician", "manager"])
      .eq("status", "active")
      .maybeSingle();
    if (!tech) return { ok: false, error: "Choose an active field-service account." };
  }

  const update = {
    assigned_tech_id: input.assignedTechId || null,
    status: input.status,
    location: clean(input.location, 500),
    scope: clean(input.scope, 4000),
    work_performed: clean(input.workPerformed, 6000),
    scheduled_window: clean(input.scheduledWindow, 200),
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error } = await supabase
    .from("chillbros_jobs")
    .update(update)
    .eq("id", input.jobId)
    .in("status", JOB_ACTIVE_STATUSES)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "This job changed while you were editing. Refresh before continuing." };

  const statusChanged = job.status !== input.status;
  const assignmentChanged = job.assigned_tech_id !== (input.assignedTechId || null);
  if (statusChanged || assignmentChanged) {
    const message = statusChanged
      ? `Dispatch changed job status to ${JOB_STATUS_LABELS[input.status]}.`
      : "Dispatch updated field-service assignment.";

    await supabase.from("chillbros_workflow_events").insert({
      job_id: input.jobId,
      actor_id: profile.id,
      stage: `dispatch_${input.status}`,
      message,
    });
    await supabase.from("chillbros_customer_service_history").insert({ customer_id: job.customer_id, note: message });
  }

  refreshJobs();
  return { ok: true };
}
