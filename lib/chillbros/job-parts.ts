"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";
import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";

const FIELD_PART_STATUSES = ["scheduled","in_progress","dispatched","en_route","arrived","diagnosing","awaiting_approval","approved","parts_required","return_visit_needed","repairing","work_complete"];
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
