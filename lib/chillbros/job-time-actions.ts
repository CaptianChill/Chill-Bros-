"use server";

import { revalidatePath } from "next/cache";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Record time on a call (labor + drive hours). Works while the call is open
 * AND after it's closed as long as its invoice isn't paid yet, so the owner
 * can update time when finishing a new issue on an existing call.
 */
export async function updateJobTimeAction(jobId: string, laborHours: number, driveHours: number): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office", "technician"].includes(profile.role)) return { ok: false, error: "Staff access required." };
  const labor = Math.round(Number(laborHours) * 100) / 100;
  const drive = Math.round(Number(driveHours) * 100) / 100;
  if (!Number.isFinite(labor) || labor < 0 || labor > 24 || !Number.isFinite(drive) || drive < 0 || drive > 24) return { ok: false, error: "Hours must be between 0 and 24." };

  const supabase = createServiceRoleClient();
  const { data: job } = await supabase.from("chillbros_jobs").select("id,status,assigned_tech_id,labor_hours,drive_hours").eq("id", jobId).maybeSingle();
  if (!job) return { ok: false, error: "Call not found." };
  if (profile.role === "technician" && job.assigned_tech_id !== profile.id) return { ok: false, error: "This call isn't assigned to you." };
  if (job.status === "cancelled") return { ok: false, error: "This call was cancelled." };
  const { data: paidInvoice } = await supabase.from("chillbros_invoices").select("id").eq("job_id", jobId).eq("payment_status", "paid").is("revoked_at", null).limit(1).maybeSingle();
  if (paidInvoice) return { ok: false, error: "This call's invoice is already paid, so its time is locked." };

  const { error } = await supabase.from("chillbros_jobs").update({ labor_hours: labor, drive_hours: drive, updated_at: new Date().toISOString() }).eq("id", jobId);
  if (error) return { ok: false, error: error.message };
  const finished = new Date().toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  await supabase.from("chillbros_workflow_events").insert({ job_id: jobId, actor_id: profile.id, stage: "time_updated", message: `Time updated ${finished} CT: labor ${Number(job.labor_hours ?? 0)} → ${labor} hr, drive ${Number(job.drive_hours ?? 0)} → ${drive} hr.` });
  for (const path of [`/jobs/${jobId}`, "/technician", "/dispatch", "/timesheet", "/reports"]) revalidatePath(path);
  return { ok: true };
}
