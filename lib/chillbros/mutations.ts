"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import type { StaffRole } from "./types";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const STAFF_ROLES = new Set<StaffRole>(["manager", "technician", "office"]);
const IMAGE_TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

async function requireManager() {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (profile.role !== "manager") return { ok: false as const, error: "Manager access required." };
  return { ok: true as const, profile };
}

function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

export async function addStaffAccountAction(input: { fullName: string; email: string; role: StaffRole }): Promise<ActionResult<{ tempPassword: string }>> {
  const guard = await requireManager();
  if (!guard.ok) return guard;

  const fullName = String(input.fullName ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!fullName || fullName.length > 200) return { ok: false, error: "Enter a valid employee name." };
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!STAFF_ROLES.has(input.role)) return { ok: false, error: "Choose a valid staff role." };

  const supabase = createServiceRoleClient();
  const tempPassword = generateTempPassword();
  const { data: created, error: createError } = await supabase.auth.admin.createUser({ email, password: tempPassword, email_confirm: true });
  if (createError || !created.user) return { ok: false, error: createError?.message ?? "Could not create the account." };

  const { error: profileError } = await supabase.from("chillbros_profiles").insert({ id: created.user.id, full_name: fullName, email, role: input.role, status: "active" });
  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: profileError.message };
  }

  revalidatePath("/manager");
  return { ok: true, data: { tempPassword } };
}

export async function resetStaffPasswordAction(staffId: string): Promise<ActionResult<{ tempPassword: string }>> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  if (!staffId) return { ok: false, error: "Employee account is required." };

  const supabase = createServiceRoleClient();
  const tempPassword = generateTempPassword();
  const { error } = await supabase.auth.admin.updateUserById(staffId, { password: tempPassword });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/manager");
  return { ok: true, data: { tempPassword } };
}

export async function toggleStaffStatusAction(staffId: string): Promise<ActionResult> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  if (!staffId) return { ok: false, error: "Employee account is required." };

  const supabase = createServiceRoleClient();
  const { data: profile, error: readError } = await supabase.from("chillbros_profiles").select("status").eq("id", staffId).maybeSingle();
  if (readError || !profile) return { ok: false, error: "Account not found." };

  const nextStatus = profile.status === "active" ? "inactive" : "active";
  if (staffId === guard.profile.id && nextStatus === "inactive") return { ok: false, error: "You cannot deactivate the manager account you are currently using." };

  const { error } = await supabase.from("chillbros_profiles").update({ status: nextStatus }).eq("id", staffId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/manager");
  return { ok: true, data: undefined };
}

export async function revokeEstimateAction(invoiceId: string): Promise<ActionResult> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const supabase = createServiceRoleClient();
  const revokedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("chillbros_invoices")
    .update({ status: "void", revoked_at: revokedAt, revoked_by: guard.profile.id })
    .eq("id", invoiceId)
    .is("revoked_at", null)
    .neq("status", "void")
    .neq("payment_status", "paid")
    .select("id, portal_token")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Paid or already-revoked estimates cannot be revoked." };
  revalidatePath("/manager");
  revalidatePath("/technician");
  revalidatePath(`/portal/${data.portal_token}`);
  return { ok: true, data: undefined };
}

export async function uploadJobPhotoAction(jobId: string, phase: "before" | "after", file: File): Promise<ActionResult> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role === "office") return { ok: false, error: "Field photos can be uploaded by the assigned technician or a manager." };
  if (phase !== "before" && phase !== "after") return { ok: false, error: "Choose a valid photo phase." };
  if (!file || file.size === 0) return { ok: false, error: "Choose a photo first." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Photo is larger than 5MB." };
  const extension = IMAGE_TYPES.get(file.type);
  if (!extension) return { ok: false, error: "Upload a JPEG, PNG, or WebP image." };

  const supabase = createServiceRoleClient();
  let jobQuery = supabase.from("chillbros_jobs").select("id").eq("id", jobId).is("archived_at", null);
  if (profile.role === "technician") jobQuery = jobQuery.eq("assigned_tech_id", profile.id).in("status", ["scheduled", "in_progress"]);
  const { data: job } = await jobQuery.maybeSingle();
  if (!job) return { ok: false, error: "This call is unavailable for photo uploads." };

  const path = `${jobId}/${phase}/${Date.now()}-${randomBytes(4).toString("hex")}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("chillbros-media").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { error: insertError } = await supabase.from("chillbros_job_photos").insert({ job_id: jobId, phase, storage_path: path, uploaded_by: profile.id });
  if (insertError) {
    await supabase.storage.from("chillbros-media").remove([path]);
    return { ok: false, error: insertError.message };
  }

  revalidatePath("/technician");
  revalidatePath("/dispatch");
  revalidatePath("/manager");
  return { ok: true, data: undefined };
}
