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
  let query = supabase.from("chillbros_jobs").select("id,scheduled_window").eq("assigned_tech_id", assignedTechId).in("status", ["scheduled", "in_progress"]).is("archived_at", null);
  if (excludeJobId) query = query.neq("id", excludeJobId);
  const { data } = await query;
  for (const row of data ?? []) {
    const existing = parseWindow(row.scheduled_window);
    if (!existing || existing.date !== date) continue;
    if (start < existing.end && end > existing.start) return existing;
  }
  return null;
}
async function verifySchedule(jobId: string, expected: string) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_jobs").select("id,scheduled_window").eq("id", jobId).maybeSingle();
  if (data?.scheduled_window === expected) return true;
  const { data: repaired } = await supabase.from("chillbros_jobs").update({ scheduled_window: expected, updated_at: new Date().toISOString() }).eq("id", jobId).select("scheduled_window").maybeSingle();
  return repaired?.scheduled_window === expected;
}

export async function createScheduledJobAction(formData: FormData): Promise<never> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const date = text(formData, "date"), start = text(formData, "start"), end = text(formData, "end"), week = text(formData, "week");
  const assignedTechId = text(formData, "assignedTechId");
  if (!validDate(date) || !validTime(start) || !validTime(end) || end <= start) go("Choose a valid date and time range.", "error", week);
  const conflict = await technicianConflict(assignedTechId, date, start, end);
  if (conflict) go(`That technician is already scheduled ${conflict.start}-${conflict.end} on ${date}.`, "error", date);
  const scheduledWindow = scheduleWindow(date, start, end);
  const result = await createJobAction({ customerId: text(formData, "customerId"), assignedTechId: assignedTechId || null, location: text(formData, "location"), scope: text(formData, "scope"), scheduledWindow });
  if (!result.ok) go(result.error, "error", date);
  if (!(await verifySchedule(result.data.jobId, scheduledWindow))) go("The call was created but its schedule did not persist. Please retry.", "error", date);
  for (const path of ["/schedule", "/dispatch", "/office", "/technician", "/customers", "/"]) revalidatePath(path);
  go("Service call scheduled and saved.", "success", date);
}

export async function createTeamMeetingAction(formData: FormData): Promise<never> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const date = text(formData, "date"), start = text(formData, "start"), end = text(formData, "end"), week = text(formData, "week");
  const title = text(formData, "title").slice(0, 180);
  const attendees = text(formData, "attendees").slice(0, 500);
  const location = text(formData, "location").slice(0, 500) || "Office / Team";
  if (!title) go("Add a meeting title.", "error", week);
  if (!validDate(date) || !validTime(start) || !validTime(end) || end <= start) go("Choose a valid meeting date and time.", "error", date);
  const supabase = createServiceRoleClient();
  let { data: internalCustomer } = await supabase.from("chillbros_customers").select("id").eq("name", "Chill Pros Team").limit(1).maybeSingle();
  if (!internalCustomer) {
    const created = await supabase.from("chillbros_customers").insert({ name: "Chill Pros Team", address: "Internal", created_by: profile.id }).select("id").single();
    if (created.error || !created.data) go(created.error?.message ?? "Could not create the internal team calendar record.", "error", date);
    internalCustomer = created.data;
  }
  const scope = `[TEAM MEETING] ${title}${attendees ? ` | Attendees: ${attendees}` : " | Whole team"}`;
  const scheduledWindow = scheduleWindow(date, start, end);
  const result = await createJobAction({ customerId: internalCustomer.id, assignedTechId: null, location, scope, scheduledWindow });
  if (!result.ok) go(result.error, "error", date);
  if (!(await verifySchedule(result.data.jobId, scheduledWindow))) go("The meeting was created but its schedule did not persist. Please retry.", "error", date);
  for (const path of ["/schedule", "/office", "/", "/dispatch"]) revalidatePath(path);
  go("Team meeting scheduled and saved.", "success", date);
}

export async function rescheduleJobAction(formData: FormData): Promise<never> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const jobId = text(formData, "jobId"), assignedTechId = text(formData, "assignedTechId"), date = text(formData, "date"), start = text(formData, "start"), end = text(formData, "end"), week = text(formData, "week");
  if (!jobId || !validDate(date) || !validTime(start) || !validTime(end) || end <= start) go("Choose a valid job, date, and time range.", "error", week);
  const supabase = createServiceRoleClient();
  if (assignedTechId) {
    const { data: tech } = await supabase.from("chillbros_profiles").select("id").eq("id", assignedTechId).in("role", ["technician", "manager"]).eq("status", "active").maybeSingle();
    if (!tech) go("Choose an active technician.", "error", date);
    const conflict = await technicianConflict(assignedTechId, date, start, end, jobId);
    if (conflict) go(`That technician is already scheduled ${conflict.start}-${conflict.end} on ${date}.`, "error", date);
  }
  const scheduledWindow = scheduleWindow(date, start, end);
  const { data, error } = await supabase.from("chillbros_jobs").update({ assigned_tech_id: assignedTechId || null, scheduled_window: scheduledWindow, status: "scheduled", updated_at: new Date().toISOString() }).eq("id", jobId).is("archived_at", null).select("id,scheduled_window").maybeSingle();
  if (error || !data) go(error?.message ?? "Schedule item not found.", "error", date);
  if (data.scheduled_window !== scheduledWindow && !(await verifySchedule(jobId, scheduledWindow))) go("Schedule update did not persist. Please retry.", "error", date);
  for (const path of ["/schedule", "/dispatch", "/office", "/technician", "/customers", "/"]) revalidatePath(path);
  go("Schedule updated and saved.", "success", date);
}
