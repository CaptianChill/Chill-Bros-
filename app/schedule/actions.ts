"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sendTechnicianAssignmentEmail, verifyTechnicianAssignment } from "@/lib/chillbros/assignment-notifications";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

function text(fd: FormData, key: string) { return String(fd.get(key) ?? "").trim(); }
function scheduleWindow(date: string, start: string, end: string) { return `${date} ${start}-${end} CT`; }
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
function validTime(value: string) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function go(message: string, type: "success" | "error", week?: string): never {
  const query = new URLSearchParams({ [type]: message, t: Date.now().toString() });
  if (week) query.set("week", week);
  redirect(`/schedule?${query.toString()}`);
}
function parseWindow(value: string | null) {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})\s+([0-2]\d:[0-5]\d)-([0-2]\d:[0-5]\d)\s+CT$/);
  return match ? { date: match[1], start: match[2], end: match[3] } : null;
}
function refreshScheduleViews() {
  for (const path of ["/schedule", "/dispatch", "/office", "/technician", "/customers", "/work-orders", "/"]) revalidatePath(path);
}

async function notifyAssignedTechnician(jobId: string, kind: "assigned" | "updated", actorId: string) {
  const result = await sendTechnicianAssignmentEmail(jobId, kind);
  const supabase = createServiceRoleClient();
  await supabase.from("chillbros_workflow_events").insert({
    job_id: jobId,
    actor_id: actorId,
    stage: result.sent ? "technician_assignment_email_sent" : "technician_assignment_email_failed",
    message: `Schedule technician notification ${result.status}${result.recipient ? ` to ${result.recipient}` : ""}.`,
  });
  if (!result.sent) console.error(`[schedule-assignment] job=${jobId} notification=${result.status}`);
  return result;
}

async function technicianConflict(assignedTechId: string, date: string, start: string, end: string, excludeJobId?: string) {
  if (!assignedTechId) return null;
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("chillbros_jobs")
    .select("id,scheduled_window")
    .eq("assigned_tech_id", assignedTechId)
    .is("archived_at", null)
    .not("scheduled_window", "is", null);
  if (excludeJobId) query = query.neq("id", excludeJobId);
  const { data, error } = await query;
  if (error) console.error("[schedule] conflict lookup failed", error);
  for (const row of data ?? []) {
    const existing = parseWindow(row.scheduled_window);
    if (!existing || existing.date !== date) continue;
    if (start < existing.end && end > existing.start) return existing;
  }
  return null;
}

async function verifySchedule(jobId: string, expected: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("chillbros_jobs")
    .select("id,status,scheduled_window")
    .eq("id", jobId)
    .maybeSingle();
  if (error) console.error("[schedule] verify read failed", error);
  if (data?.scheduled_window === expected && data.status === "scheduled") return true;

  const { data: repaired, error: repairError } = await supabase
    .from("chillbros_jobs")
    .update({ scheduled_window: expected, status: "scheduled", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .select("scheduled_window,status")
    .maybeSingle();
  if (repairError) console.error("[schedule] verify repair failed", repairError);
  return repaired?.scheduled_window === expected && repaired.status === "scheduled";
}

async function insertCalendarJob(input: {
  customerId: string;
  assignedTechId?: string | null;
  location?: string;
  scope?: string;
  scheduledWindow: string;
}) {
  const supabase = createServiceRoleClient();
  const customerId = input.customerId.trim();
  if (!customerId) return { ok: false as const, error: "Choose a customer." };

  const { data: customer, error: customerError } = await supabase
    .from("chillbros_customers")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();
  if (customerError || !customer) return { ok: false as const, error: customerError?.message ?? "Customer record not found." };

  if (input.assignedTechId) {
    const { data: tech, error: techError } = await supabase
      .from("chillbros_profiles")
      .select("id")
      .eq("id", input.assignedTechId)
      .in("role", ["technician", "manager"])
      .eq("status", "active")
      .maybeSingle();
    if (techError || !tech) return { ok: false as const, error: techError?.message ?? "Choose an active technician." };
  }

  const { data, error } = await supabase
    .from("chillbros_jobs")
    .insert({
      customer_id: customerId,
      assigned_tech_id: input.assignedTechId || null,
      status: "scheduled",
      location: input.location?.trim().slice(0, 500) || null,
      scope: input.scope?.trim().slice(0, 4000) || null,
      scheduled_window: input.scheduledWindow,
      updated_at: new Date().toISOString(),
    })
    .select("id,scheduled_window,status,assigned_tech_id")
    .single();

  if (error || !data) {
    console.error("[schedule] direct insert failed", error);
    return { ok: false as const, error: error?.message ?? "Could not save this calendar item." };
  }

  if (data.scheduled_window !== input.scheduledWindow || data.status !== "scheduled") {
    if (!(await verifySchedule(data.id, input.scheduledWindow))) {
      return { ok: false as const, error: "The calendar row was created but the date/time did not persist." };
    }
  }
  if ((input.assignedTechId || null) !== data.assigned_tech_id) {
    return { ok: false as const, error: "The call saved but the technician assignment did not persist." };
  }

  return { ok: true as const, jobId: data.id };
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
  if (conflict) go(`That technician is already scheduled ${conflict.start}-${conflict.end} on ${date}.`, "error", date);

  const scheduledWindow = scheduleWindow(date, start, end);
  const result = await insertCalendarJob({
    customerId: text(formData, "customerId"),
    assignedTechId: assignedTechId || null,
    location: text(formData, "location"),
    scope: text(formData, "scope"),
    scheduledWindow,
  });
  if (!result.ok) go(result.error, "error", date);

  const supabase = createServiceRoleClient();
  await supabase.from("chillbros_customer_service_history").insert({
    customer_id: text(formData, "customerId"),
    note: `Calendar call saved • ${scheduledWindow}`,
  });

  if (assignedTechId) {
    const verified = await verifyTechnicianAssignment(result.jobId, assignedTechId);
    if (!verified.ok) go(verified.error, "error", date);
    const notification = await notifyAssignedTechnician(result.jobId, "assigned", profile.id);
    if (!notification.sent) go(`Call assigned, but technician email failed: ${notification.status}.`, "error", date);
  }
  refreshScheduleViews();
  go("Saved to calendar and technician assignment verified.", "success", date);
}

export async function createTeamMeetingAction(formData: FormData): Promise<never> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");

  const date = text(formData, "date");
  const start = text(formData, "start");
  const end = text(formData, "end");
  const week = text(formData, "week");
  const title = text(formData, "title").slice(0, 180);
  const attendees = text(formData, "attendees").slice(0, 500);
  const location = text(formData, "location").slice(0, 500) || "Office / Team";

  if (!title) go("Add a meeting title.", "error", week);
  if (!validDate(date) || !validTime(start) || !validTime(end) || end <= start) go("Choose a valid meeting date and time.", "error", date);

  const supabase = createServiceRoleClient();
  let { data: internalCustomer } = await supabase.from("chillbros_customers").select("id").eq("name", "Chill Pros Team").limit(1).maybeSingle();
  if (!internalCustomer) {
    const created = await supabase
      .from("chillbros_customers")
      .insert({ name: "Chill Pros Team", address: "Internal", created_by: profile.id })
      .select("id")
      .single();
    if (created.error || !created.data) go(created.error?.message ?? "Could not create the internal team calendar record.", "error", date);
    internalCustomer = created.data;
  }

  const scope = `[TEAM MEETING] ${title}${attendees ? ` | Attendees: ${attendees}` : " | Whole team"}`;
  const scheduledWindow = scheduleWindow(date, start, end);
  const result = await insertCalendarJob({ customerId: internalCustomer.id, assignedTechId: null, location, scope, scheduledWindow });
  if (!result.ok) go(result.error, "error", date);

  refreshScheduleViews();
  go("Meeting saved to calendar.", "success", date);
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
    if (!tech) go("Choose an active technician.", "error", date);
    const conflict = await technicianConflict(assignedTechId, date, start, end, jobId);
    if (conflict) go(`That technician is already scheduled ${conflict.start}-${conflict.end} on ${date}.`, "error", date);
  }

  const scheduledWindow = scheduleWindow(date, start, end);
  const { data, error } = await supabase
    .from("chillbros_jobs")
    .update({ assigned_tech_id: assignedTechId || null, scheduled_window: scheduledWindow, status: "scheduled", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .is("archived_at", null)
    .select("id,scheduled_window,status,assigned_tech_id")
    .maybeSingle();

  if (error || !data) go(error?.message ?? "Schedule item not found.", "error", date);
  if ((data.scheduled_window !== scheduledWindow || data.status !== "scheduled") && !(await verifySchedule(jobId, scheduledWindow))) {
    go("Schedule update did not persist. Please retry.", "error", date);
  }
  if (data.assigned_tech_id !== (assignedTechId || null)) go("Schedule saved, but technician assignment did not persist.", "error", date);

  if (assignedTechId) {
    const verified = await verifyTechnicianAssignment(jobId, assignedTechId);
    if (!verified.ok) go(verified.error, "error", date);
    const notification = await notifyAssignedTechnician(jobId, "updated", profile.id);
    if (!notification.sent) go(`Schedule updated, but technician email failed: ${notification.status}.`, "error", date);
  }
  refreshScheduleViews();
  go("Schedule and technician assignment verified.", "success", date);
}

export async function deleteCalendarItemAction(formData: FormData): Promise<never> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");

  const jobId = text(formData, "jobId");
  const week = text(formData, "week");
  if (!jobId) go("Schedule item not found.", "error", week);

  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("chillbros_jobs")
    .update({ status: "cancelled", archived_at: now, updated_at: now })
    .eq("id", jobId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) go(error?.message ?? "Could not remove that schedule item.", "error", week);

  refreshScheduleViews();
  go("Schedule item removed.", "success", week);
}