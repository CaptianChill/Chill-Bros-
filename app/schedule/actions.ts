"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { JOB_ACTIVE_STATUSES, JOB_STATUS_LABELS, type JobStatus } from "@/lib/chillbros/types";
import { isRescheduleReason, RESCHEDULE_REASONS, technicianRescheduleStatus } from "@/lib/chillbros/work-page";

import { sendTechnicianAssignmentEmail, verifyTechnicianAssignment } from "@/lib/chillbros/assignment-notifications";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

function text(fd: FormData, key: string) { return String(fd.get(key) ?? "").trim(); }
function scheduleWindow(date: string, start: string, end: string) { return `${date} ${start}-${end} CT`; }
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
function validTime(value: string) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function go(message: string, type: "success" | "error", week?: string, warning?: string): never {
  const query = new URLSearchParams({ [type]: message, t: Date.now().toString() });
  if (week) query.set("week", week);
  if (warning) query.set("warning", warning);
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
  let result;
  try { result = await sendTechnicianAssignmentEmail(jobId, kind); }
  catch (error) { result = { sent: false, status: error instanceof Error ? error.message : "Technician notification failed.", recipient: null }; }
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
    .in("status", JOB_ACTIVE_STATUSES)
    .not("scheduled_window", "is", null);
  if (excludeJobId) query = query.neq("id", excludeJobId);
  const { data, error } = await query;
  if (error) return { date, start, end, error: `Could not check technician availability: ${error.message}` };
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
  return !error && data?.scheduled_window === expected;
}

async function insertCalendarJob(input: {
  submissionId?: string;
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
      ...(input.submissionId ? { id: input.submissionId } : {}),
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
    if (error?.code === "23505" && input.submissionId) {
      const { data: existing } = await supabase.from("chillbros_jobs").select("id,customer_id,assigned_tech_id,scheduled_window").eq("id", input.submissionId).is("archived_at", null).maybeSingle();
      if (existing?.customer_id === customerId && existing.assigned_tech_id === (input.assignedTechId || null) && existing.scheduled_window === input.scheduledWindow) return { ok: true as const, jobId: existing.id, alreadySaved: true };
    }
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
  const submissionId = text(formData, "submissionId");
  if (submissionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) go("Invalid submission. Refresh and try again.", "error", week);

  if (!validDate(date) || !validTime(start) || !validTime(end) || end <= start) go("Choose a valid date and time range.", "error", week);
  const supabase = createServiceRoleClient();
  const scheduledWindow = scheduleWindow(date, start, end);
  let duplicateQuery = supabase.from("chillbros_jobs").select("id")
    .eq("customer_id", text(formData, "customerId"))
    .eq("scheduled_window", scheduledWindow).is("archived_at", null)
    .gte("created_at", new Date(Date.now() - 120_000).toISOString());
  duplicateQuery = assignedTechId ? duplicateQuery.eq("assigned_tech_id", assignedTechId) : duplicateQuery.is("assigned_tech_id", null);
  const { data: duplicate, error: duplicateError } = await duplicateQuery.limit(1).maybeSingle();
  if (duplicateError) go(duplicateError.message, "error", date);
  if (duplicate) go("Already saved", "success", date);
  const conflict = await technicianConflict(assignedTechId, date, start, end);
  if (conflict) go("error" in conflict ? conflict.error : `That technician is already scheduled ${conflict.start}-${conflict.end} on ${date}.`, "error", date);

  const result = await insertCalendarJob({
    submissionId,
    customerId: text(formData, "customerId"),
    assignedTechId: assignedTechId || null,
    location: text(formData, "location"),
    scope: text(formData, "scope"),
    scheduledWindow,
  });
  if (!result.ok) go(result.error, "error", date);
  if (result.alreadySaved) go("Already saved", "success", date);

  await supabase.from("chillbros_customer_service_history").insert({
    customer_id: text(formData, "customerId"),
    note: `Calendar call saved • ${scheduledWindow}`,
  });

  if (assignedTechId) {
    const verified = await verifyTechnicianAssignment(result.jobId, assignedTechId);
    if (!verified.ok) { refreshScheduleViews(); go("Call saved.", "success", date, verified.error); }
    const notification = await notifyAssignedTechnician(result.jobId, "assigned", profile.id);
    if (!notification.sent) { refreshScheduleViews(); go("Call saved.", "success", date, `Call saved. Technician email not sent: ${notification.status}`); }
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
  let assignedTechId = text(formData, "assignedTechId");
  const date = text(formData, "date");
  const start = text(formData, "start");
  const end = text(formData, "end");
  const week = text(formData, "week");

  if (!jobId || !validDate(date) || !validTime(start) || !validTime(end) || end <= start) go("Choose a valid job, date, and time range.", "error", week);

  const supabase = createServiceRoleClient();
  const { data: current, error: readError } = await supabase.from("chillbros_jobs")
    .select("status,assigned_tech_id,updated_at,scheduled_window").eq("id", jobId).is("archived_at", null).maybeSingle();
  if (readError || !current) go(readError?.message ?? "Call not found.", "error", date);
  if (["completed", "paid", "cancelled"].includes(current.status)) go(`Cannot reschedule a call with current status "${current.status}".`, "error", date);
  assignedTechId = assignedTechId || current.assigned_tech_id || "";
  const status = ["new", "needs_scheduling"].includes(current.status) ? "scheduled" : current.status;
  if (assignedTechId) {
    const { data: tech } = await supabase.from("chillbros_profiles").select("id").eq("id", assignedTechId).in("role", ["technician", "manager"]).eq("status", "active").maybeSingle();
    if (!tech) go("Choose an active technician.", "error", date);
    const conflict = await technicianConflict(assignedTechId, date, start, end, jobId);
    if (conflict) go("error" in conflict ? conflict.error : `That technician is already scheduled ${conflict.start}-${conflict.end} on ${date}.`, "error", date);
  }

  const scheduledWindow = scheduleWindow(date, start, end);
  const { data, error } = await supabase
    .from("chillbros_jobs")
    .update({ assigned_tech_id: assignedTechId || null, scheduled_window: scheduledWindow, status, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", current.status)
    .eq("updated_at", current.updated_at)
    .is("archived_at", null)
    .select("id,scheduled_window,status,assigned_tech_id")
    .maybeSingle();

  if (error || !data) go(error?.message ?? "Schedule item not found.", "error", date);
  if (data.scheduled_window !== scheduledWindow && !(await verifySchedule(jobId, scheduledWindow))) {
    go("Schedule update did not persist. Please retry.", "error", date);
  }
  if (data.assigned_tech_id !== (assignedTechId || null)) go("Schedule saved, but technician assignment did not persist.", "error", date);
  await logReschedule({ jobId, actor: profile, from: current.scheduled_window, to: scheduledWindow, reason: null, statusBefore: current.status, statusAfter: status });

  if (assignedTechId) {
    const verified = await verifyTechnicianAssignment(jobId, assignedTechId);
    if (!verified.ok) { refreshScheduleViews(); go("Call saved.", "success", date, verified.error); }
    const notification = await notifyAssignedTechnician(jobId, "updated", profile.id);
    if (!notification.sent) { refreshScheduleViews(); go("Call saved.", "success", date, `Call saved. Technician email not sent: ${notification.status}`); }
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

function describeWindow(value: string | null) {
  const slot = parseWindow(value);
  return slot ? `${slot.date} ${slot.start}-${slot.end}` : value?.trim() || "no time set";
}

// History entry so the owner sees who moved a call, from/to, and why.
async function logReschedule(input: { jobId: string; actor: { id: string; fullName: string; role: string }; from: string | null; to: string; reason: string | null; statusBefore: string; statusAfter: string }) {
  const supabase = createServiceRoleClient();
  const statusNote = input.statusBefore !== input.statusAfter
    ? ` Status ${JOB_STATUS_LABELS[input.statusBefore as JobStatus] ?? input.statusBefore} → ${JOB_STATUS_LABELS[input.statusAfter as JobStatus] ?? input.statusAfter}.`
    : "";
  const message = `Rescheduled by ${input.actor.fullName} (${input.actor.role}): ${describeWindow(input.from)} → ${describeWindow(input.to)}.${input.reason ? ` Reason: ${input.reason}.` : ""}${statusNote}`;
  const { error } = await supabase.from("chillbros_workflow_events").insert({ job_id: input.jobId, actor_id: input.actor.id, stage: "rescheduled", message });
  if (error) console.error(`[schedule] reschedule history failed job=${input.jobId}`, error);
  const { data: job } = await supabase.from("chillbros_jobs").select("customer_id").eq("id", input.jobId).maybeSingle();
  if (job?.customer_id) await supabase.from("chillbros_customer_service_history").insert({ customer_id: job.customer_id, note: message });
}

function techGo(jobId: string, type: "success" | "error", message: string): never {
  if (type === "success") redirect(`/technician?${new URLSearchParams({ rescheduled: jobId, success: message })}`);
  redirect(`/jobs/${encodeURIComponent(jobId)}?${new URLSearchParams({ error: message, reschedule: "1" })}`);
}

/**
 * The assigned technician moves their own call (customer not ready, no
 * access, out of time, waiting on parts...). Same job row, same validation and
 * conflict check as the office reschedule; the technician can never change
 * who the job is assigned to. Status follows technicianRescheduleStatus.
 */
export async function rescheduleOwnJobAction(formData: FormData): Promise<never> {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role !== "technician" && profile.role !== "manager") redirect("/");

  const jobId = text(formData, "jobId");
  const date = text(formData, "date");
  const start = text(formData, "start");
  const end = text(formData, "end");
  const reasonKey = text(formData, "reason");
  const note = text(formData, "note").slice(0, 300);
  if (!jobId) redirect("/technician");
  if (!validDate(date) || !validTime(start) || !validTime(end) || end <= start) techGo(jobId, "error", "Choose a valid date and time range.");
  if (!isRescheduleReason(reasonKey)) techGo(jobId, "error", "Choose why the call is being rescheduled.");
  if (reasonKey === "other" && !note) techGo(jobId, "error", "Add a short note for \"Other\".");

  const supabase = createServiceRoleClient();
  let read = supabase.from("chillbros_jobs")
    .select("status,assigned_tech_id,updated_at,scheduled_window").eq("id", jobId).is("archived_at", null);
  if (profile.role === "technician") read = read.eq("assigned_tech_id", profile.id);
  const { data: current, error: readError } = await read.maybeSingle();
  if (readError) techGo(jobId, "error", readError.message);
  if (!current) redirect("/technician");

  const nextStatus = technicianRescheduleStatus(current.status as JobStatus, reasonKey);
  if (!nextStatus) techGo(jobId, "error", `A call that is ${JOB_STATUS_LABELS[current.status as JobStatus] ?? current.status} can't be rescheduled from the field. Ask the office.`);

  // Keep whoever is assigned now; form input is never used for assignment here.
  const assignedTechId: string | null = current.assigned_tech_id;
  if (assignedTechId) {
    const conflict = await technicianConflict(assignedTechId, date, start, end, jobId);
    if (conflict) techGo(jobId, "error", "error" in conflict ? conflict.error : `You're already scheduled ${conflict.start}-${conflict.end} on ${date}.`);
  }

  const scheduledWindow = scheduleWindow(date, start, end);
  let update = supabase
    .from("chillbros_jobs")
    .update({ scheduled_window: scheduledWindow, status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", current.status)
    .eq("updated_at", current.updated_at)
    .is("archived_at", null);
  if (profile.role === "technician") update = update.eq("assigned_tech_id", profile.id);
  const { data, error } = await update.select("id,scheduled_window,assigned_tech_id").maybeSingle();
  if (error || !data) techGo(jobId, "error", error?.message ?? "This call changed while you were editing. Refresh and try again.");
  if (data.scheduled_window !== scheduledWindow && !(await verifySchedule(jobId, scheduledWindow))) techGo(jobId, "error", "The new time did not save. Please retry.");

  const reason = `${RESCHEDULE_REASONS[reasonKey]}${note ? ` — ${note}` : ""}`;
  await logReschedule({ jobId, actor: profile, from: current.scheduled_window, to: scheduledWindow, reason, statusBefore: current.status, statusAfter: nextStatus });
  refreshScheduleViews();
  revalidatePath(`/jobs/${jobId}`);
  const slot = parseWindow(scheduledWindow)!;
  techGo(jobId, "success", `Rescheduled to ${slot.date} ${slot.start}-${slot.end}. Notes, photos and parts stay on the job.`);
}
