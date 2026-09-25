"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { FIELD_EDIT_STATUSES, isPartFieldStatus } from "./work-page";

const FIELD_PART_STATUSES: string[] = FIELD_EDIT_STATUSES;
type Result = { ok: true } | { ok: false; error: string };

async function canEditJob(jobId: string) {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (profile.role === "manager") return { ok: true as const };
  if (profile.role !== "technician") return { ok: false as const, error: "Technician or manager access required." };
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_jobs").select("id").eq("id", jobId).eq("assigned_tech_id", profile.id).in("status", FIELD_PART_STATUSES).maybeSingle();
  if (!data) return { ok: false as const, error: "You cannot change parts on this job." };
  return { ok: true as const };
}

function refreshPartsViews() { for (const path of ["/technician","/inventory","/inventory/intelligence","/dispatch","/manager","/manager/command"]) revalidatePath(path); }

export async function addJobPartAtomicAction(jobId: string, partId: string, quantity: number): Promise<Result> {
  const allowed = await canEditJob(jobId); if (!allowed.ok) return allowed;
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > 100) return { ok: false, error: "Quantity must be between 1 and 100." };
  const supabase = createServiceRoleClient();
  const { error } = await supabase.rpc("chillbros_add_job_part", { p_job_id: jobId, p_part_id: partId, p_quantity: qty });
  if (error) return { ok: false, error: error.message.includes("insufficient stock") ? "Not enough stock for that quantity." : error.message };
  refreshPartsViews(); return { ok: true };
}

export async function setJobPartQuantityAtomicAction(jobPartId: string, quantity: number): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!["manager", "technician"].includes(profile.role)) return { ok: false, error: "Technician or manager access required." };
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 0 || qty > 1000) return { ok: false, error: "Quantity must be between 0 and 1000." };
  const supabase = createServiceRoleClient();
  const { data: row } = await supabase.from("chillbros_job_parts").select("job_id, job:chillbros_jobs(assigned_tech_id,status)").eq("id", jobPartId).maybeSingle();
  if (!row) return { ok: false, error: "Job part not found." };
  const job = Array.isArray(row.job) ? row.job[0] : row.job;
  if (profile.role === "technician" && (job?.assigned_tech_id !== profile.id || !FIELD_PART_STATUSES.includes(job?.status ?? ""))) return { ok: false, error: "You cannot change parts on this job." };
  const { error } = await supabase.rpc("chillbros_set_job_part_quantity", { p_job_part_id: jobPartId, p_quantity: qty });
  if (error) return { ok: false, error: error.message.includes("insufficient stock") ? "Not enough stock for that quantity." : error.message };
  refreshPartsViews(); return { ok: true };
}

export async function removeJobPartAtomicAction(jobPartId: string): Promise<Result> { return setJobPartQuantityAtomicAction(jobPartId, 0); }

async function canEditJobPart(jobPartId: string) {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (!["manager", "technician"].includes(profile.role)) return { ok: false as const, error: "Technician or manager access required." };
  const supabase = createServiceRoleClient();
  const { data: row } = await supabase.from("chillbros_job_parts").select("job_id, job:chillbros_jobs(assigned_tech_id,status)").eq("id", jobPartId).maybeSingle();
  if (!row) return { ok: false as const, error: "Job part not found." };
  const job = Array.isArray(row.job) ? row.job[0] : row.job;
  if (profile.role === "technician" && (job?.assigned_tech_id !== profile.id || !FIELD_PART_STATUSES.includes(job?.status ?? ""))) return { ok: false as const, error: "You cannot change parts on this job." };
  return { ok: true as const, jobId: row.job_id as string };
}

/** On truck / Need to order / Ordered, plus a short note, for one part on a job. */
export async function setJobPartFieldAction(jobPartId: string, input: { fieldStatus: string; notes: string }): Promise<Result> {
  const allowed = await canEditJobPart(jobPartId); if (!allowed.ok) return allowed;
  if (!isPartFieldStatus(input.fieldStatus)) return { ok: false, error: "Choose On truck, Need to order, or Ordered." };
  const notes = String(input.notes ?? "").trim().slice(0, 1000) || null;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_job_parts").update({ field_status: input.fieldStatus, notes }).eq("id", jobPartId).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Job part not found." };
  revalidatePath(`/jobs/${allowed.jobId}`);
  refreshPartsViews(); return { ok: true };
}

/**
 * A part the technician doesn't have and has to order. Saved as a catalog item
 * that isn't stock-tracked (so no inventory is taken or added), put on the job,
 * and marked Need to order. Existing catalog prices are never changed here.
 */
export async function addNeedToOrderPartAction(input: { jobId: string; name: string; partNumber: string; price: number; quantity: number; notes: string }): Promise<Result> {
  const allowed = await canEditJob(input.jobId); if (!allowed.ok) return allowed;
  const name = String(input.name ?? "").trim().slice(0, 200);
  const qty = Math.floor(Number(input.quantity));
  const price = Number(input.price || 0);
  if (!name) return { ok: false, error: "Enter the part name." };
  if (!Number.isFinite(qty) || qty < 1 || qty > 100) return { ok: false, error: "Quantity must be between 1 and 100." };
  if (!Number.isFinite(price) || price < 0 || price > 100000) return { ok: false, error: "Enter a valid price (or leave it blank)." };
  const partNumber = String(input.partNumber ?? "").trim().slice(0, 120) || `ORDER-${Date.now().toString(36).toUpperCase()}`;
  if (partNumber.startsWith("PB-")) return { ok: false, error: "PB- is reserved for the manager price book." };

  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase.from("chillbros_parts_catalog").select("id,track_inventory,stock").eq("part_number", partNumber).maybeSingle();
  let partId = existing?.id as string | undefined;
  if (existing?.track_inventory && Number(existing.stock ?? 0) < qty) {
    return { ok: false, error: `Part # ${partNumber} is a stocked inventory item with ${existing.stock ?? 0} on hand. Ask the office to order it, or use a different part #.` };
  }
  if (!partId) {
    const { data: created, error } = await supabase.from("chillbros_parts_catalog")
      .insert({ name, part_number: partNumber, default_cost: 0, retail_price: price, stock: 0, track_inventory: false })
      .select("id").single();
    if (error || !created) return { ok: false, error: error?.message ?? "Could not save the part." };
    partId = created.id;
  }

  const { data: jobPartId, error: addError } = await supabase.rpc("chillbros_add_job_part", { p_job_id: input.jobId, p_part_id: partId, p_quantity: qty });
  if (addError || !jobPartId) return { ok: false, error: addError?.message ?? "Could not add the part to this job." };
  const notes = String(input.notes ?? "").trim().slice(0, 1000) || null;
  const { error: statusError } = await supabase.from("chillbros_job_parts").update({ field_status: "need_to_order", notes }).eq("id", jobPartId);
  if (statusError) return { ok: false, error: `Part added, but its status didn't save: ${statusError.message}` };
  revalidatePath(`/jobs/${input.jobId}`);
  refreshPartsViews(); return { ok: true };
}
