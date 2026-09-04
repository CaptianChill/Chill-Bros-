import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type { JobStatus } from "./types";

export type DispatchJob = { id: string; customerId: string; customerName: string; assignedTechId: string | null; assignedTechName: string | null; status: JobStatus; location: string | null; scope: string | null; workPerformed: string | null; scheduledWindow: string | null; createdAt: string; workflowStage: string };
export type ActiveTechnician = { id: string; fullName: string };
export type OpenTimesheet = { id: string; location: string | null; clockInAt: string; jobId: string | null; breakStartedAt: string | null; breakMinutes: number };
export type TimesheetHistoryRow = { id: string; technicianName: string; location: string | null; clockInAt: string; clockOutAt: string | null; laborHours: number; driveHours: number };
export type AssignedJobOption = { id: string; customerName: string; location: string | null; scheduledWindow: string | null; status: "scheduled" | "in_progress" };

export async function getDispatchJobs(limit = 100): Promise<DispatchJob[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_jobs").select("id, customer_id, assigned_tech_id, status, location, scope, work_performed, scheduled_window, created_at, customer:chillbros_customers(name), tech:chillbros_profiles(full_name)").order("created_at", { ascending: false }).limit(limit);
  if (error || !data) return [];
  const ids = data.map((row) => row.id);
  const [{ data: invoices }, { data: events }] = ids.length ? await Promise.all([
    supabase.from("chillbros_invoices").select("job_id,status,payment_status,updated_at").in("job_id", ids).is("revoked_at", null).neq("status", "void").order("updated_at", { ascending: false }),
    supabase.from("chillbros_workflow_events").select("job_id,stage,created_at").in("job_id", ids).order("created_at", { ascending: false }),
  ]) : [{ data: [] }, { data: [] }];
  const stageByJob = new Map<string, string>();
  for (const e of events ?? []) if (e.job_id && !stageByJob.has(e.job_id)) stageByJob.set(e.job_id, e.stage);
  for (const i of invoices ?? []) if (i.job_id && !stageByJob.has(i.job_id)) stageByJob.set(i.job_id, i.payment_status === "paid" ? "paid" : i.status === "approved" ? "approved" : "awaiting_approval");
  return data.map((row) => { const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer; const tech = Array.isArray(row.tech) ? row.tech[0] : row.tech; return { id: row.id, customerId: row.customer_id, customerName: customer?.name ?? "Unknown customer", assignedTechId: row.assigned_tech_id, assignedTechName: tech?.full_name ?? null, status: row.status, location: row.location, scope: row.scope, workPerformed: row.work_performed, scheduledWindow: row.scheduled_window, createdAt: row.created_at, workflowStage: stageByJob.get(row.id) ?? row.status }; });
}

export async function getActiveTechnicians(): Promise<ActiveTechnician[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_profiles").select("id, full_name").eq("role", "technician").eq("status", "active").order("full_name", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({ id: row.id, fullName: row.full_name }));
}

export async function getAssignedJobsForTech(technicianId: string): Promise<AssignedJobOption[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_jobs").select("id, status, location, scheduled_window, customer:chillbros_customers(name)").eq("assigned_tech_id", technicianId).in("status", ["scheduled", "in_progress"]).order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => { const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer; return { id: row.id, customerName: customer?.name ?? "Unknown customer", location: row.location, scheduledWindow: row.scheduled_window, status: row.status as "scheduled" | "in_progress" }; });
}

export async function getOpenTimesheet(technicianId: string): Promise<OpenTimesheet | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_timesheets").select("id, location, clock_in_at, job_id").eq("technician_id", technicianId).is("clock_out_at", null).order("clock_in_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  const { data: breaks } = await supabase.from("chillbros_timesheet_breaks").select("started_at,ended_at").eq("timesheet_id", data.id).order("started_at", { ascending: true });
  let breakMinutes = 0;
  let breakStartedAt: string | null = null;
  for (const b of breaks ?? []) {
    if (!b.ended_at) {
      breakStartedAt = b.started_at;
      continue;
    }
    breakMinutes += Math.max(0, new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 60000;
  }
  return { id: data.id, location: data.location, clockInAt: data.clock_in_at, jobId: data.job_id, breakStartedAt, breakMinutes: Math.round(breakMinutes) };
}

export async function getTimesheetHistory(limit = 100): Promise<TimesheetHistoryRow[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_timesheets").select("id, location, clock_in_at, clock_out_at, labor_hours, drive_hours, tech:chillbros_profiles(full_name)").order("clock_in_at", { ascending: false }).limit(limit);
  if (error || !data) return [];
  return data.map((row) => { const tech = Array.isArray(row.tech) ? row.tech[0] : row.tech; return { id: row.id, technicianName: tech?.full_name ?? "Unknown technician", location: row.location, clockInAt: row.clock_in_at, clockOutAt: row.clock_out_at, laborHours: Number(row.labor_hours ?? 0), driveHours: Number(row.drive_hours ?? 0) }; });
}
