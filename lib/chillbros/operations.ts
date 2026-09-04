"use server";

import { revalidatePath } from "next/cache";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import type { JobStatus } from "./types";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function requireManager() {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (profile.role !== "manager") return { ok: false as const, error: "Manager access required." };
  return { ok: true as const, profile };
}

async function requireOfficeOrManager() {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (!["manager", "office"].includes(profile.role)) return { ok: false as const, error: "Office or manager access required." };
  return { ok: true as const, profile };
}

function cleanText(value: string | null | undefined, max = 2000) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

export async function createCustomerAction(input: {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}): Promise<Result<{ customerId: string }>> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Customer name is required." };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("chillbros_customers")
    .insert({
      name: name.slice(0, 200),
      address: cleanText(input.address, 500),
      phone: cleanText(input.phone, 50),
      email: cleanText(input.email, 320)?.toLowerCase() ?? null,
      created_by: guard.profile.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create customer." };

  revalidatePath("/crm");
  revalidatePath("/dispatch");
  revalidatePath("/office");
  revalidatePath("/");
  return { ok: true, data: { customerId: data.id } };
}

export async function updateCustomerAction(input: {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}): Promise<Result> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Customer name is required." };

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("chillbros_customers")
    .update({
      name: name.slice(0, 200),
      address: cleanText(input.address, 500),
      phone: cleanText(input.phone, 50),
      email: cleanText(input.email, 320)?.toLowerCase() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/crm");
  revalidatePath("/dispatch");
  revalidatePath("/office");
  return { ok: true, data: undefined };
}

export async function createJobAction(input: {
  customerId: string;
  assignedTechId?: string | null;
  location?: string;
  scope?: string;
  scheduledWindow?: string;
}): Promise<Result<{ jobId: string }>> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  if (!input.customerId) return { ok: false, error: "Choose a customer." };

  const supabase = createServiceRoleClient();
  if (input.assignedTechId) {
    const { data: tech } = await supabase
      .from("chillbros_profiles")
      .select("id")
      .eq("id", input.assignedTechId)
      .eq("role", "technician")
      .eq("status", "active")
      .maybeSingle();
    if (!tech) return { ok: false, error: "Choose an active technician." };
  }

  const { data, error } = await supabase
    .from("chillbros_jobs")
    .insert({
      customer_id: input.customerId,
      assigned_tech_id: input.assignedTechId || null,
      status: "scheduled",
      location: cleanText(input.location, 500),
      scope: cleanText(input.scope, 4000),
      scheduled_window: cleanText(input.scheduledWindow, 200),
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create job." };

  await supabase.from("chillbros_customer_service_history").insert({
    customer_id: input.customerId,
    note: `Job created${input.scheduledWindow ? ` • ${input.scheduledWindow}` : ""}`,
  });

  revalidatePath("/dispatch");
  revalidatePath("/technician");
  revalidatePath("/crm");
  revalidatePath("/office");
  revalidatePath("/");
  return { ok: true, data: { jobId: data.id } };
}

export async function updateJobAction(input: {
  jobId: string;
  assignedTechId?: string | null;
  status: JobStatus;
  location?: string;
  scope?: string;
  workPerformed?: string;
  scheduledWindow?: string;
}): Promise<Result> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;

  const supabase = createServiceRoleClient();
  const { data: job, error: readError } = await supabase
    .from("chillbros_jobs")
    .select("id, customer_id, status")
    .eq("id", input.jobId)
    .maybeSingle();
  if (readError || !job) return { ok: false, error: "Job not found." };

  if (input.assignedTechId) {
    const { data: tech } = await supabase
      .from("chillbros_profiles")
      .select("id")
      .eq("id", input.assignedTechId)
      .eq("role", "technician")
      .eq("status", "active")
      .maybeSingle();
    if (!tech) return { ok: false, error: "Choose an active technician." };
  }

  const { error } = await supabase
    .from("chillbros_jobs")
    .update({
      assigned_tech_id: input.assignedTechId || null,
      status: input.status,
      location: cleanText(input.location, 500),
      scope: cleanText(input.scope, 4000),
      work_performed: cleanText(input.workPerformed, 6000),
      scheduled_window: cleanText(input.scheduledWindow, 200),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.jobId);
  if (error) return { ok: false, error: error.message };

  if (job.status !== input.status) {
    await supabase.from("chillbros_customer_service_history").insert({
      customer_id: job.customer_id,
      note: `Job status changed to ${input.status.replace(/_/g, " ")}`,
    });
  }

  revalidatePath("/dispatch");
  revalidatePath("/technician");
  revalidatePath("/crm");
  revalidatePath("/office");
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function updateTechnicianJobAction(input: {
  jobId: string;
  status: "scheduled" | "in_progress" | "completed";
  workPerformed?: string;
  laborHours?: number;
  driveHours?: number;
}): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role !== "technician") return { ok: false, error: "Technician access required." };

  const laborHours = Number(input.laborHours ?? 0);
  const driveHours = Number(input.driveHours ?? 0);
  if (!Number.isFinite(laborHours) || laborHours < 0 || laborHours > 24) return { ok: false, error: "Labor hours are invalid." };
  if (!Number.isFinite(driveHours) || driveHours < 0 || driveHours > 24) return { ok: false, error: "Drive hours are invalid." };

  const supabase = createServiceRoleClient();
  const { data: job, error: readError } = await supabase
    .from("chillbros_jobs")
    .select("id, customer_id, status")
    .eq("id", input.jobId)
    .eq("assigned_tech_id", profile.id)
    .maybeSingle();
  if (readError || !job) return { ok: false, error: "This job is not assigned to you." };

  const { error } = await supabase
    .from("chillbros_jobs")
    .update({
      status: input.status,
      work_performed: cleanText(input.workPerformed, 6000),
      labor_hours: laborHours,
      drive_hours: driveHours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.jobId)
    .eq("assigned_tech_id", profile.id);
  if (error) return { ok: false, error: error.message };

  if (job.status !== input.status || input.status === "completed") {
    const note = input.status === "completed"
      ? `Service completed${input.workPerformed ? ` • ${input.workPerformed.slice(0, 500)}` : ""}`
      : `Technician changed job status to ${input.status.replace(/_/g, " ")}`;
    await supabase.from("chillbros_customer_service_history").insert({ customer_id: job.customer_id, note });
  }

  revalidatePath("/technician");
  revalidatePath("/dispatch");
  revalidatePath("/crm");
  revalidatePath("/office");
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function addJobPartAction(jobId: string, partId: string, quantity: number): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > 100) return { ok: false, error: "Quantity must be between 1 and 100." };

  const supabase = createServiceRoleClient();
  if (profile.role === "technician") {
    const { data: job } = await supabase
      .from("chillbros_jobs")
      .select("id")
      .eq("id", jobId)
      .eq("assigned_tech_id", profile.id)
      .in("status", ["scheduled", "in_progress"])
      .maybeSingle();
    if (!job) return { ok: false, error: "This job is not assigned to you." };
  }

  const { data: part, error: partError } = await supabase
    .from("chillbros_parts_catalog")
    .select("id, stock")
    .eq("id", partId)
    .maybeSingle();
  if (partError || !part) return { ok: false, error: "Part not found." };
  if (part.stock < qty) return { ok: false, error: `Only ${part.stock} in stock.` };

  const { error: insertError } = await supabase.from("chillbros_job_parts").insert({ job_id: jobId, part_id: partId, quantity: qty });
  if (insertError) return { ok: false, error: insertError.message };

  const { error: stockError } = await supabase.from("chillbros_parts_catalog").update({ stock: part.stock - qty, updated_at: new Date().toISOString() }).eq("id", partId);
  if (stockError) {
    await supabase.from("chillbros_job_parts").delete().eq("job_id", jobId).eq("part_id", partId).eq("quantity", qty);
    return { ok: false, error: stockError.message };
  }

  revalidatePath("/technician");
  revalidatePath("/inventory");
  return { ok: true, data: undefined };
}

export async function removeJobPartAction(jobPartId: string): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  const supabase = createServiceRoleClient();

  const { data: row, error: readError } = await supabase
    .from("chillbros_job_parts")
    .select("id, job_id, part_id, quantity, job:chillbros_jobs(assigned_tech_id, status)")
    .eq("id", jobPartId)
    .maybeSingle();
  if (readError || !row) return { ok: false, error: "Job part not found." };
  const job = Array.isArray(row.job) ? row.job[0] : row.job;
  if (profile.role === "technician" && (job?.assigned_tech_id !== profile.id || !["scheduled", "in_progress"].includes(job?.status ?? ""))) {
    return { ok: false, error: "You cannot change parts on this job." };
  }

  const { data: part } = await supabase.from("chillbros_parts_catalog").select("stock").eq("id", row.part_id).maybeSingle();
  const { error: deleteError } = await supabase.from("chillbros_job_parts").delete().eq("id", row.id);
  if (deleteError) return { ok: false, error: deleteError.message };
  if (part) await supabase.from("chillbros_parts_catalog").update({ stock: part.stock + row.quantity, updated_at: new Date().toISOString() }).eq("id", row.part_id);

  revalidatePath("/technician");
  revalidatePath("/inventory");
  return { ok: true, data: undefined };
}

export async function createPartAction(input: { name: string; partNumber: string; defaultCost: number; retailPrice: number; stock: number }): Promise<Result> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const name = input.name.trim();
  const partNumber = input.partNumber.trim();
  if (!name || !partNumber) return { ok: false, error: "Part name and part number are required." };
  const defaultCost = Number(input.defaultCost);
  const retailPrice = Number(input.retailPrice);
  const stock = Math.floor(Number(input.stock));
  if (![defaultCost, retailPrice, stock].every(Number.isFinite) || defaultCost < 0 || retailPrice < 0 || stock < 0) return { ok: false, error: "Cost, retail, and stock must be nonnegative numbers." };

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("chillbros_parts_catalog").insert({ name: name.slice(0, 200), part_number: partNumber.slice(0, 120), default_cost: defaultCost, retail_price: retailPrice, stock });
  if (error) return { ok: false, error: error.code === "23505" ? "That part number already exists." : error.message };
  revalidatePath("/inventory");
  return { ok: true, data: undefined };
}

export async function updatePartAction(input: { id: string; name: string; partNumber: string; defaultCost: number; retailPrice: number; stock: number }): Promise<Result> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("chillbros_parts_catalog").update({
    name: input.name.trim().slice(0, 200),
    part_number: input.partNumber.trim().slice(0, 120),
    default_cost: Math.max(0, Number(input.defaultCost) || 0),
    retail_price: Math.max(0, Number(input.retailPrice) || 0),
    stock: Math.max(0, Math.floor(Number(input.stock) || 0)),
    updated_at: new Date().toISOString(),
  }).eq("id", input.id);
  if (error) return { ok: false, error: error.code === "23505" ? "That part number already exists." : error.message };
  revalidatePath("/inventory");
  revalidatePath("/technician");
  return { ok: true, data: undefined };
}

export async function deletePartAction(partId: string): Promise<Result> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const supabase = createServiceRoleClient();
  const { count } = await supabase.from("chillbros_job_parts").select("id", { count: "exact", head: true }).eq("part_id", partId);
  if ((count ?? 0) > 0) return { ok: false, error: "This part has job history and cannot be deleted. Set stock to 0 instead." };
  const { error } = await supabase.from("chillbros_parts_catalog").delete().eq("id", partId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory");
  return { ok: true, data: undefined };
}

export async function updateFeeAction(id: string, amount: number): Promise<Result> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const cleanAmount = Number(amount);
  if (!Number.isFinite(cleanAmount) || cleanAmount < 0 || cleanAmount > 100000) return { ok: false, error: "Fee amount is invalid." };
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("chillbros_fee_settings").update({ amount: cleanAmount, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory");
  revalidatePath("/manager");
  revalidatePath("/technician");
  return { ok: true, data: undefined };
}
