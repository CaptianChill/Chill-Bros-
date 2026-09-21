"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type ManagerTimesheetInput = {
  timesheetId?: string;
  technicianId: string;
  clockInAt: string;
  clockOutAt?: string | null;
  location?: string;
  laborHours?: number;
  driveHours?: number;
};

function refreshTimesheets() { revalidatePath("/timesheet"); revalidatePath("/manager"); revalidatePath("/office"); revalidatePath("/dispatch"); }
function canClock(role: string) { return role === "technician" || role === "office" || role === "manager"; }
function hours(ms: number) { return Math.round(Math.max(0, ms) / 36000) / 100; }
function validDate(value: string | null | undefined) { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? date : null; }
function validHours(value: number | undefined) { const n = Number(value ?? 0); return Number.isFinite(n) && n >= 0 && n <= 24 ? n : null; }

async function requireManager() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") return { ok: false as const, error: "Manager access required." };
  return { ok: true as const, profile };
}

async function calculateWorkedHours(timesheetId: string, clockInAt: string, clockOutAt: string) {
  const supabase = createServiceRoleClient();
  const { data: breaks } = await supabase.from("chillbros_timesheet_breaks").select("started_at,ended_at").eq("timesheet_id", timesheetId);
  const end = new Date(clockOutAt).getTime();
  const start = new Date(clockInAt).getTime();
  const breakMs = (breaks ?? []).reduce((sum, row) => {
    const breakStart = new Date(row.started_at).getTime();
    const breakEnd = new Date(row.ended_at ?? clockOutAt).getTime();
    return sum + Math.max(0, breakEnd - breakStart);
  }, 0);
  return hours(Math.max(0, end - start - breakMs));
}

export async function clockInResilientAction(location: string): Promise<Result<{ timesheetId: string; clockInAt: string; location: string | null }>> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!canClock(profile.role)) return { ok: false, error: "Time capture is available to technician and office staff accounts." };
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase.from("chillbros_timesheets").select("id, clock_in_at, location").eq("technician_id", profile.id).is("clock_out_at", null).order("clock_in_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) return { ok: true, data: { timesheetId: existing.id, clockInAt: existing.clock_in_at, location: existing.location } };
  const activeJob = profile.role === "technician"
    ? (await supabase.from("chillbros_jobs").select("id, location").eq("assigned_tech_id", profile.id).in("status", ["scheduled", "in_progress"]).order("created_at", { ascending: true }).limit(1).maybeSingle()).data
    : null;
  const cleanLocation = String(location ?? "").trim() || activeJob?.location || (profile.role === "office" || profile.role === "manager" ? "Office" : null);
  const { data, error } = await supabase.from("chillbros_timesheets").insert({ technician_id: profile.id, job_id: activeJob?.id ?? null, location: cleanLocation, clock_in_at: new Date().toISOString() }).select("id, clock_in_at, location").single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "You already have an open clock session. Refresh the page." : error?.message ?? "Could not clock in." };
  await supabase.from("chillbros_profiles").update({ last_clock_event: `Clocked in ${new Date(data.clock_in_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}` }).eq("id", profile.id);
  refreshTimesheets();
  return { ok: true, data: { timesheetId: data.id, clockInAt: data.clock_in_at, location: data.location } };
}

export async function startBreakAction(timesheetId: string): Promise<Result<{ startedAt: string }>> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !canClock(profile.role)) return { ok: false, error: "Time capture access required." };
  const supabase = createServiceRoleClient();
  const { data: sheet } = await supabase.from("chillbros_timesheets").select("id").eq("id", timesheetId).eq("technician_id", profile.id).is("clock_out_at", null).maybeSingle();
  if (!sheet) return { ok: false, error: "Open clock session not found." };
  const startedAt = new Date().toISOString();
  const { error } = await supabase.from("chillbros_timesheet_breaks").insert({ timesheet_id: timesheetId, started_at: startedAt });
  if (error) return { ok: false, error: error.code === "23505" ? "A break is already open." : error.message };
  await supabase.from("chillbros_profiles").update({ last_clock_event: "On break" }).eq("id", profile.id);
  refreshTimesheets();
  return { ok: true, data: { startedAt } };
}

export async function endBreakAction(timesheetId: string): Promise<Result<{ endedAt: string }>> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !canClock(profile.role)) return { ok: false, error: "Time capture access required." };
  const supabase = createServiceRoleClient();
  const { data: sheet } = await supabase.from("chillbros_timesheets").select("id").eq("id", timesheetId).eq("technician_id", profile.id).is("clock_out_at", null).maybeSingle();
  if (!sheet) return { ok: false, error: "Open clock session not found." };
  const endedAt = new Date().toISOString();
  const { data, error } = await supabase.from("chillbros_timesheet_breaks").update({ ended_at: endedAt }).eq("timesheet_id", timesheetId).is("ended_at", null).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "No open break found." };
  await supabase.from("chillbros_profiles").update({ last_clock_event: "Working" }).eq("id", profile.id);
  refreshTimesheets();
  return { ok: true, data: { endedAt } };
}

export async function clockOutResilientAction(timesheetId: string, laborHours: number, driveHours: number): Promise<Result<{ clockOutAt: string }>> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!canClock(profile.role)) return { ok: false, error: "Time capture access required." };
  const requestedLabor = validHours(laborHours);
  const drive = validHours(driveHours);
  if (requestedLabor === null || drive === null) return { ok: false, error: "Labor and drive hours must be between 0 and 24." };
  const supabase = createServiceRoleClient();
  const { data: sheet } = await supabase.from("chillbros_timesheets").select("id,clock_in_at").eq("id", timesheetId).eq("technician_id", profile.id).is("clock_out_at", null).maybeSingle();
  if (!sheet) return { ok: false, error: "This clock session is already closed or unavailable." };
  const clockOutAt = new Date().toISOString();
  await supabase.from("chillbros_timesheet_breaks").update({ ended_at: clockOutAt }).eq("timesheet_id", timesheetId).is("ended_at", null);
  const worked = await calculateWorkedHours(timesheetId, sheet.clock_in_at, clockOutAt);
  const labor = requestedLabor > 0 ? requestedLabor : Math.max(0, Math.round((worked - drive) * 100) / 100);
  const { data, error } = await supabase.from("chillbros_timesheets").update({ clock_out_at: clockOutAt, labor_hours: labor, drive_hours: drive }).eq("id", timesheetId).eq("technician_id", profile.id).is("clock_out_at", null).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "This clock session is already closed or unavailable." };
  await supabase.from("chillbros_profiles").update({ last_clock_event: `Clocked out ${new Date(clockOutAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}` }).eq("id", profile.id);
  refreshTimesheets();
  return { ok: true, data: { clockOutAt } };
}

export async function managerCreateTimesheetAction(input: ManagerTimesheetInput): Promise<Result<{ timesheetId: string }>> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const clockIn = validDate(input.clockInAt);
  const clockOut = input.clockOutAt ? validDate(input.clockOutAt) : null;
  const labor = validHours(input.laborHours);
  const drive = validHours(input.driveHours);
  if (!clockIn || (input.clockOutAt && !clockOut) || labor === null || drive === null) return { ok: false, error: "Check the clock times and hour values." };
  if (clockOut && clockOut < clockIn) return { ok: false, error: "Clock out cannot be before clock in." };
  const supabase = createServiceRoleClient();
  const { data: staff } = await supabase.from("chillbros_profiles").select("id,role,full_name").eq("id", input.technicianId).in("role", ["technician", "office"]).maybeSingle();
  if (!staff) return { ok: false, error: "Employee account not found." };
  if (!clockOut) {
    const { data: existing } = await supabase.from("chillbros_timesheets").select("id").eq("technician_id", input.technicianId).is("clock_out_at", null).limit(1).maybeSingle();
    if (existing) return { ok: false, error: "That employee already has an open clock session." };
  }
  const { data, error } = await supabase.from("chillbros_timesheets").insert({ technician_id: input.technicianId, job_id: null, location: String(input.location ?? "").trim() || null, clock_in_at: clockIn.toISOString(), clock_out_at: clockOut?.toISOString() ?? null, labor_hours: labor, drive_hours: drive }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the time entry." };
  await supabase.from("chillbros_profiles").update({ last_clock_event: clockOut ? `Manager corrected time ${new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago" })}` : "Clocked in by manager" }).eq("id", input.technicianId);
  refreshTimesheets();
  return { ok: true, data: { timesheetId: data.id } };
}

export async function managerUpdateTimesheetAction(input: ManagerTimesheetInput & { timesheetId: string }): Promise<Result> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const clockIn = validDate(input.clockInAt);
  const clockOut = input.clockOutAt ? validDate(input.clockOutAt) : null;
  const labor = validHours(input.laborHours);
  const drive = validHours(input.driveHours);
  if (!clockIn || (input.clockOutAt && !clockOut) || labor === null || drive === null) return { ok: false, error: "Check the clock times and hour values." };
  if (clockOut && clockOut < clockIn) return { ok: false, error: "Clock out cannot be before clock in." };
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase.from("chillbros_timesheets").select("id,technician_id,job_id").eq("id", input.timesheetId).maybeSingle();
  if (!existing) return { ok: false, error: "Time entry not found." };
  const { error } = await supabase.from("chillbros_timesheets").update({ location: String(input.location ?? "").trim() || null, clock_in_at: clockIn.toISOString(), clock_out_at: clockOut?.toISOString() ?? null, labor_hours: labor, drive_hours: drive }).eq("id", input.timesheetId);
  if (error) return { ok: false, error: error.message };
  if (existing.job_id) await supabase.from("chillbros_workflow_events").insert({ job_id: existing.job_id, actor_id: guard.profile.id, stage: "timesheet_corrected", message: "Manager corrected the employee time record." });
  await supabase.from("chillbros_profiles").update({ last_clock_event: clockOut ? "Time corrected by manager" : "Open shift adjusted by manager" }).eq("id", existing.technician_id);
  refreshTimesheets();
  return { ok: true, data: undefined };
}

export async function managerClockOutNowAction(timesheetId: string): Promise<Result<{ clockOutAt: string; laborHours: number }>> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const supabase = createServiceRoleClient();
  const { data: sheet } = await supabase.from("chillbros_timesheets").select("id,technician_id,job_id,clock_in_at,drive_hours").eq("id", timesheetId).is("clock_out_at", null).maybeSingle();
  if (!sheet) return { ok: false, error: "Open time entry not found." };
  const clockOutAt = new Date().toISOString();
  await supabase.from("chillbros_timesheet_breaks").update({ ended_at: clockOutAt }).eq("timesheet_id", timesheetId).is("ended_at", null);
  const worked = await calculateWorkedHours(timesheetId, sheet.clock_in_at, clockOutAt);
  const drive = Number(sheet.drive_hours ?? 0);
  const labor = Math.max(0, Math.round((worked - drive) * 100) / 100);
  const { error } = await supabase.from("chillbros_timesheets").update({ clock_out_at: clockOutAt, labor_hours: labor }).eq("id", timesheetId).is("clock_out_at", null);
  if (error) return { ok: false, error: error.message };
  if (sheet.job_id) await supabase.from("chillbros_workflow_events").insert({ job_id: sheet.job_id, actor_id: guard.profile.id, stage: "manager_clock_out", message: "Manager closed the employee clock session." });
  await supabase.from("chillbros_profiles").update({ last_clock_event: `Clocked out by manager ${new Date(clockOutAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}` }).eq("id", sheet.technician_id);
  refreshTimesheets();
  return { ok: true, data: { clockOutAt, laborHours: labor } };
}
