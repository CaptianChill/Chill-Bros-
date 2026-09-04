"use server";

import { revalidatePath } from "next/cache";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

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

function refreshCustomerViews() {
  for (const path of ["/crm", "/dispatch", "/office", "/"]) revalidatePath(path);
}

export async function createCustomerAction(input: { name: string; address?: string; phone?: string; email?: string }): Promise<Result<{ customerId: string }>> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  const name = String(input.name ?? "").trim();
  const email = cleanText(input.email, 320)?.toLowerCase() ?? null;
  if (!name || name.length > 200) return { ok: false, error: "Customer name is required and must be 200 characters or fewer." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid customer email address." };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_customers").insert({
    name,
    address: cleanText(input.address, 500),
    phone: cleanText(input.phone, 50),
    email,
    created_by: guard.profile.id,
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create customer." };

  refreshCustomerViews();
  return { ok: true, data: { customerId: data.id } };
}

export async function updateCustomerAction(input: { id: string; name: string; address?: string; phone?: string; email?: string }): Promise<Result> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  const name = String(input.name ?? "").trim();
  const email = cleanText(input.email, 320)?.toLowerCase() ?? null;
  if (!input.id) return { ok: false, error: "Customer record is required." };
  if (!name || name.length > 200) return { ok: false, error: "Customer name is required and must be 200 characters or fewer." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid customer email address." };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_customers").update({
    name,
    address: cleanText(input.address, 500),
    phone: cleanText(input.phone, 50),
    email,
    updated_at: new Date().toISOString(),
  }).eq("id", input.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Customer record not found." };

  refreshCustomerViews();
  revalidatePath(`/customers/${input.id}`);
  return { ok: true, data: undefined };
}

export async function createJobAction(input: { customerId: string; assignedTechId?: string | null; location?: string; scope?: string; scheduledWindow?: string }): Promise<Result<{ jobId: string }>> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  if (!input.customerId) return { ok: false, error: "Choose a customer." };

  const supabase = createServiceRoleClient();
  const { data: customer } = await supabase.from("chillbros_customers").select("id").eq("id", input.customerId).maybeSingle();
  if (!customer) return { ok: false, error: "Customer record not found." };

  if (input.assignedTechId) {
    const { data: tech } = await supabase.from("chillbros_profiles").select("id").eq("id", input.assignedTechId).eq("role", "technician").eq("status", "active").maybeSingle();
    if (!tech) return { ok: false, error: "Choose an active technician." };
  }

  const { data, error } = await supabase.from("chillbros_jobs").insert({
    customer_id: input.customerId,
    assigned_tech_id: input.assignedTechId || null,
    status: "scheduled",
    location: cleanText(input.location, 500),
    scope: cleanText(input.scope, 4000),
    scheduled_window: cleanText(input.scheduledWindow, 200),
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create job." };

  await supabase.from("chillbros_customer_service_history").insert({ customer_id: input.customerId, note: `Job created${input.scheduledWindow ? ` • ${String(input.scheduledWindow).slice(0, 150)}` : ""}` });
  for (const path of ["/dispatch", "/technician", "/crm", "/office", "/"]) revalidatePath(path);
  return { ok: true, data: { jobId: data.id } };
}

export async function createPartAction(input: { name: string; partNumber: string; defaultCost: number; retailPrice: number; stock: number }): Promise<Result> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const name = String(input.name ?? "").trim();
  const partNumber = String(input.partNumber ?? "").trim();
  const defaultCost = Number(input.defaultCost);
  const retailPrice = Number(input.retailPrice);
  const stock = Math.floor(Number(input.stock));
  if (!name || !partNumber || name.length > 200 || partNumber.length > 120) return { ok: false, error: "Part name and part number are required." };
  if (![defaultCost, retailPrice, stock].every(Number.isFinite) || defaultCost < 0 || retailPrice < 0 || stock < 0 || stock > 100000) return { ok: false, error: "Cost, retail, and stock must be valid nonnegative numbers." };

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("chillbros_parts_catalog").insert({ name, part_number: partNumber, default_cost: defaultCost, retail_price: retailPrice, stock });
  if (error) return { ok: false, error: error.code === "23505" ? "That part number already exists." : error.message };
  revalidatePath("/inventory");
  revalidatePath("/technician");
  return { ok: true, data: undefined };
}

export async function updatePartAction(input: { id: string; name: string; partNumber: string; defaultCost: number; retailPrice: number; stock: number }): Promise<Result> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const name = String(input.name ?? "").trim();
  const partNumber = String(input.partNumber ?? "").trim();
  const defaultCost = Number(input.defaultCost);
  const retailPrice = Number(input.retailPrice);
  const stock = Math.floor(Number(input.stock));
  if (!input.id || !name || !partNumber || name.length > 200 || partNumber.length > 120) return { ok: false, error: "Part name and part number are required." };
  if (![defaultCost, retailPrice, stock].every(Number.isFinite) || defaultCost < 0 || retailPrice < 0 || stock < 0 || stock > 100000) return { ok: false, error: "Cost, retail, and stock must be valid nonnegative numbers." };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_parts_catalog").update({ name, part_number: partNumber, default_cost: defaultCost, retail_price: retailPrice, stock, updated_at: new Date().toISOString() }).eq("id", input.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "That part number already exists." : error?.message ?? "Part not found." };
  revalidatePath("/inventory");
  revalidatePath("/technician");
  return { ok: true, data: undefined };
}

export async function deletePartAction(partId: string): Promise<Result> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  if (!partId) return { ok: false, error: "Part record is required." };
  const supabase = createServiceRoleClient();
  const { count } = await supabase.from("chillbros_job_parts").select("id", { count: "exact", head: true }).eq("part_id", partId);
  if ((count ?? 0) > 0) return { ok: false, error: "This part has job history and cannot be deleted. Set stock to 0 instead." };
  const { data, error } = await supabase.from("chillbros_parts_catalog").delete().eq("id", partId).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Part not found." };
  revalidatePath("/inventory");
  return { ok: true, data: undefined };
}

export async function updateFeeAction(id: string, amount: number): Promise<Result> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const cleanAmount = Number(amount);
  if (!id || !Number.isFinite(cleanAmount) || cleanAmount < 0 || cleanAmount > 100000) return { ok: false, error: "Fee amount is invalid." };
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_fee_settings").update({ amount: cleanAmount, updated_at: new Date().toISOString() }).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Fee setting not found." };
  revalidatePath("/inventory");
  revalidatePath("/manager");
  revalidatePath("/technician");
  return { ok: true, data: undefined };
}
