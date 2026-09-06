"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type { JobStatus } from "./types";

type Result = { ok: true } | { ok: false; error: string };
const ACTIVE_STATUSES = ["scheduled", "in_progress"] as const;
const clean = (value: string | null | undefined, max: number) => { const s = String(value ?? "").trim(); return s ? s.slice(0, max) : null; };
function refreshJobs() { for (const path of ["/technician", "/dispatch", "/manager", "/office", "/crm", "/invoices", "/"]) revalidatePath(path); }

export async function updateTechnicianJobV2Action(input: { jobId: string; status: "scheduled" | "in_progress" | "completed"; workPerformed?: string; laborHours?: number; driveHours?: number }): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["technician", "manager"].includes(profile.role)) return { ok: false, error: "Technician or manager access required." };

  const labor = Number(input.laborHours ?? 0);
  const drive = Number(input.driveHours ?? 0);
  if (!Number.isFinite(labor) || labor < 0 || labor > 24 || !Number.isFinite(drive) || drive < 0 || drive > 24) return { ok: false, error: "Labor and drive hours must be between 0 and 24." };

  const supabase = createServiceRoleClient();
  let jobQuery = supabase
    .from("chillbros_jobs")
    .select("id,customer_id,status,work_performed,labor_hours,drive_hours,assigned_tech_id")
    .eq("id", input.jobId);
  if (profile.role === "technician") jobQuery = jobQuery.eq("assigned_tech_id", profile.id);
  const { data: job } = await jobQuery.maybeSingle();
  if (!job) return { ok: false, error: profile.role === "manager" ? "Job not found." : "This job is not assigned to you." };
  if (!ACTIVE_STATUSES.includes(job.status as (typeof ACTIVE_STATUSES)[number])) return { ok: false, error: "This call is already closed or cancelled and is locked from field edits." };

  const work = clean(input.workPerformed, 6000);
  let updateQuery = supabase
    .from("chillbros_jobs")
    .update({ status: input.status, work_performed: work, labor_hours: labor, drive_hours: drive, updated_at: new Date().toISOString() })
    .eq("id", input.jobId)
    .in("status", [...ACTIVE_STATUSES]);
  if (profile.role === "technician") updateQuery = updateQuery.eq("assigned_tech_id", profile.id);
  const { data: updated, error } = await updateQuery.select("id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "This call changed while you were editing. Refresh before continuing." };

  const statusChanged = job.status !== input.status;
  const notesChanged = (job.work_performed ?? "") !== (work ?? "");
  if (statusChanged || notesChanged || Number(job.labor_hours) !== labor || Number(job.drive_hours) !== drive) {
    const stage = input.status === "completed" ? "tech_complete" : input.status === "in_progress" ? "tech_in_progress" : "tech_saved";
    const actorLabel = profile.role === "manager" ? "Manager/owner" : "Technician";
    const message = input.status === "completed" ? `${actorLabel} completed service notes. Estimate/invoice workflow is ready for office review.` : statusChanged ? `${actorLabel} changed call status to ${input.status.replace(/_/g, " ")}.` : `${actorLabel} service notes/time autosaved.`;
    await supabase.from("chillbros_workflow_events").insert({ job_id: input.jobId, actor_id: profile.id, stage, message });
    if (statusChanged || input.status === "completed") await supabase.from("chillbros_customer_service_history").insert({ customer_id: job.customer_id, note: message });
  }

  refreshJobs();
  return { ok: true };
}

export async function updateDispatchJobV2Action(input: { jobId: string; assignedTechId?: string | null; status: JobStatus; location?: string; scope?: string; workPerformed?: string; scheduledWindow?: string }): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) return { ok: false, error: "Office or manager access required." };
  if (!ACTIVE_STATUSES.includes(input.status as (typeof ACTIVE_STATUSES)[number])) return { ok: false, error: "Use Close call or Cancel call for terminal status changes." };

  const supabase = createServiceRoleClient();
  const { data: job } = await supabase
    .from("chillbros_jobs")
    .select("id,customer_id,status,assigned_tech_id,location,scope,scheduled_window")
    .eq("id", input.jobId)
    .maybeSingle();
  if (!job) return { ok: false, error: "Job not found." };
  if (!ACTIVE_STATUSES.includes(job.status as (typeof ACTIVE_STATUSES)[number])) return { ok: false, error: "Closed and cancelled calls are read-only." };

  if (input.assignedTechId) {
    const { data: tech } = await supabase.from("chillbros_profiles").select("id").eq("id", input.assignedTechId).in("role", ["technician", "manager"]).eq("status", "active").maybeSingle();
    if (!tech) return { ok: false, error: "Choose an active field-service account." };
  }

  const update = { assigned_tech_id: input.assignedTechId || null, status: input.status, location: clean(input.location, 500), scope: clean(input.scope, 4000), work_performed: clean(input.workPerformed, 6000), scheduled_window: clean(input.scheduledWindow, 200), updated_at: new Date().toISOString() };
  const { data: updated, error } = await supabase
    .from("chillbros_jobs")
    .update(update)
    .eq("id", input.jobId)
    .in("status", [...ACTIVE_STATUSES])
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "This call changed while you were editing. Refresh before continuing." };

  const statusChanged = job.status !== input.status;
  const assignmentChanged = job.assigned_tech_id !== (input.assignedTechId || null);
  if (statusChanged || assignmentChanged) {
    const message = statusChanged ? `Dispatch changed call status to ${input.status.replace(/_/g, " ")}.` : "Dispatch updated field-service assignment.";
    await supabase.from("chillbros_workflow_events").insert({ job_id: input.jobId, actor_id: profile.id, stage: `dispatch_${input.status}`, message });
    await supabase.from("chillbros_customer_service_history").insert({ customer_id: job.customer_id, note: message });
  }

  refreshJobs();
  return { ok: true };
}
