"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { JOB_ACTIVE_STATUSES, JOB_STATUS_LABELS, type JobStatus } from "./types";
import { canFieldSetStatus } from "./work-page";

type Result = { ok: true } | { ok: false; error: string };

const clean = (value: string | null | undefined, max: number) => {
  const s = String(value ?? "").trim();
  return s ? s.slice(0, max) : null;
};

function refreshJobs() {
  for (const path of ["/technician", "/technician/history", "/work", "/dispatch", "/manager", "/office", "/crm", "/invoices", "/customers", "/"]) revalidatePath(path);
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

  const labor = input.laborHours === undefined ? undefined : Number(input.laborHours);
  const drive = input.driveHours === undefined ? undefined : Number(input.driveHours);
  if ((labor !== undefined && (!Number.isFinite(labor) || labor < 0 || labor > 24)) || (drive !== undefined && (!Number.isFinite(drive) || drive < 0 || drive > 24))) {
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
  if (!canFieldSetStatus(job.status as JobStatus, nextStatus)) return { ok: false, error: `A job that is ${JOB_STATUS_LABELS[job.status as JobStatus]} can't move to ${JOB_STATUS_LABELS[nextStatus] ?? "that status"} from the field.` };
  // Only fields the caller sent are written, so a status-only change never
  // clears the saved notes or hours.
  const work = input.workPerformed === undefined ? (job.work_performed ?? null) : clean(input.workPerformed, 6000);
  const nextLabor = labor ?? Number(job.labor_hours);
  const nextDrive = drive ?? Number(job.drive_hours);
  let updateQuery = supabase
    .from("chillbros_jobs")
    .update({ status: nextStatus, work_performed: work, labor_hours: nextLabor, drive_hours: nextDrive, updated_at: new Date().toISOString() })
    .eq("id", input.jobId)
    .eq("status", job.status);
  if (profile.role === "technician") updateQuery = updateQuery.eq("assigned_tech_id", profile.id);

  const { data: updated, error } = await updateQuery.select("id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "This job changed while you were editing. Refresh before continuing." };

  const statusChanged = job.status !== nextStatus;
  const notesChanged = (job.work_performed ?? "") !== (work ?? "");
  if (statusChanged || notesChanged || Number(job.labor_hours) !== nextLabor || Number(job.drive_hours) !== nextDrive) {
    const actorLabel = `${profile.fullName} (${profile.role === "manager" ? "manager/owner" : "technician"})`;
    const message = statusChanged
      ? `${actorLabel} changed job status to ${JOB_STATUS_LABELS[nextStatus]}.`
      : `${actorLabel} saved service notes/time.`;

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
