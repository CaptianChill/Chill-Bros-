"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createJobAction } from "@/lib/chillbros/operations";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

function text(fd: FormData, key: string) { return String(fd.get(key) ?? "").trim(); }
function scheduleWindow(date: string, start: string, end: string) { return `${date} ${start}-${end} CT`; }
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
function validTime(value: string) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function go(message: string, type: "success" | "error", week?: string): never {
  const query = new URLSearchParams({ [type]: message });
  if (week) query.set("week", week);
  redirect(`/schedule?${query.toString()}`);
}

function parseWindow(value: string | null) {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})\s+([0-2]\d:[0-5]\d)-([0-2]\d:[0-5]\d)\s+CT$/);
  return match ? { date: match[1], start: match[2], end: match[3] } : null;
}

async function technicianConflict(assignedTechId: string, date: string, start: string, end: string, excludeJobId?: string) {
  if (!assignedTechId) return null;
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("chillbros_jobs")
    .select("id,scheduled_window")
    .eq("assigned_tech_id", assignedTechId)
    .in("status", ["scheduled", "in_progress"])
    .is("archived_at", null);
  if (excludeJobId) query = query.neq("id", excludeJobId);
  const { data } = await query;
  for (const row of data ?? []) {
    const existing = parseWindow(row.scheduled_window);
    if (!existing || existing.date !== date) continue;
    if (start < existing.end && end > existing.start) return existing;
  }
  return null;
}

export async function createScheduledJobAction(formData: FormData): Promise<never> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const date = text(formData, "date");
  const start = text(formData, "start");
  const end = text(formData, "end");
  const week = text(formData, "week");
  const assignedTechId = text(formData, "assignedTechId");
  if (!validDate(date) || !validTime(start) || !validTime(end) || end <= start) go("Choose a valid date and time range.", "error", week);

  const conflict = await technicianConflict(assignedTechId, date, start, end);
  if (conflict) go(`That technician is already scheduled ${conflict.start}-${conflict.end} on ${date}. Choose another time or technician.`, "error", week);

  const result = await createJobAction({
    customerId: text(formData, "customerId"),
    assignedTechId: assignedTechId || null,
    location: text(formData, "location"),
    scope: text(formData, "scope"),
    scheduledWindow: scheduleWindow(date, start, end),
  });
  if (!result.ok) go(result.error, "error", week);
  revalidatePath("/schedule");
  go("Job scheduled.", "success", week);
}

export async function rescheduleJobAction(formData: FormData): Promise<never> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const jobId = text(formData, "jobId");
  const assignedTechId = text(formData, "assignedTechId");
  const date = text(formData, "date");
  const start = text(formData, "start");
  const end = text(formData, "end");
  const week = text(formData, "week");
  if (!jobId || !validDate(date) || !validTime(start) || !validTime(end) || end <= start) go("Choose a valid job, date, and time range.", "error", week);

  const supabase = createServiceRoleClient();
  if (assignedTechId) {
    const { data: tech } = await supabase.from("chillbros_profiles").select("id").eq("id", assignedTechId).in("role", ["technician", "manager"]).eq("status", "active").maybeSingle();
    if (!tech) go("Choose an active technician.", "error", week);
    const conflict = await technicianConflict(assignedTechId, date, start, end, jobId);
    if (conflict) go(`That technician is already scheduled ${conflict.start}-${conflict.end} on ${date}. Choose another time or technician.`, "error", week);
  }

  const { data, error } = await supabase.from("chillbros_jobs").update({
    assigned_tech_id: assignedTechId || null,
    scheduled_window: scheduleWindow(date, start, end),
    status: "scheduled",
    updated_at: new Date().toISOString(),
  }).eq("id", jobId).is("archived_at", null).select("id").maybeSingle();
  if (error || !data) go(error?.message ?? "Job not found.", "error", week);

  for (const path of ["/schedule", "/dispatch", "/office", "/technician", "/"]) revalidatePath(path);
  go("Schedule updated.", "success", week);
}
