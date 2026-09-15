"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/server";
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

const OWNER_EMAIL = "chillprostx@gmail.com";

async function requireCredentialAdministrator() {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  if (guard.profile.email.trim().toLowerCase() !== OWNER_EMAIL) {
    return { ok: false as const, error: "Owner access is required to create or reset staff logins." };
  }
  return guard;
}

function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

type NeonAdminUser = { id: string; email?: string | null };
type NeonAdminResult<T = unknown> = {
  data?: T | null;
  error?: { message?: string } | null;
};
type NeonAdminApi = {
  createUser?: (input: { email: string; password: string; name: string; role: string }) => Promise<NeonAdminResult<{ user?: NeonAdminUser }>>;
  listUsers?: (input: { query: { searchValue: string; searchField: "email"; limit: number } }) => Promise<NeonAdminResult<{ users?: NeonAdminUser[] }>>;
  removeUser?: (input: { userId: string }) => Promise<NeonAdminResult>;
  setRole?: (input: { userId: string; role: string }) => Promise<NeonAdminResult>;
  setUserPassword?: (input: { userId: string; newPassword: string }) => Promise<NeonAdminResult>;
};

function neonAdmin(): NeonAdminApi | null {
  const server = auth as unknown as { admin?: NeonAdminApi; api?: { admin?: NeonAdminApi } };
  return server.admin ?? server.api?.admin ?? null;
}

function authErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

async function findNeonUserByEmail(admin: NeonAdminApi, email: string): Promise<ActionResult<NeonAdminUser | null>> {
  if (!admin.listUsers) return { ok: false, error: "Neon staff lookup is unavailable. Sign out, sign back in, and try again." };
  try {
    const { data, error } = await admin.listUsers({
      query: { searchValue: email, searchField: "email", limit: 20 },
    });
    if (error) return { ok: false, error: authErrorMessage(error, "Could not check the Neon staff directory.") };
    const user = (data?.users ?? []).find((candidate) => candidate.email?.trim().toLowerCase() === email) ?? null;
    return { ok: true, data: user };
  } catch (error) {
    return { ok: false, error: authErrorMessage(error, "Could not check the Neon staff directory.") };
  }
}

export async function addStaffAccountAction(input: { fullName: string; email: string; role: StaffRole }): Promise<ActionResult<{ tempPassword: string }>> {
  const guard = await requireCredentialAdministrator();
  if (!guard.ok) return guard;

  const fullName = String(input.fullName ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!fullName || fullName.length > 200) return { ok: false, error: "Enter a valid employee name." };
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!STAFF_ROLES.has(input.role)) return { ok: false, error: "Choose a valid staff role." };

  const service = createServiceRoleClient();
  const { data: existingProfiles, error: profileLookupError } = await service
    .from("chillbros_profiles")
    .select("id")
    .ilike("email", email)
    .limit(1);
  if (profileLookupError) return { ok: false, error: "Could not check existing employee accounts." };
  if (existingProfiles?.length) return { ok: false, error: "An employee account already uses this email address." };

  const admin = neonAdmin();
  if (!admin?.createUser || !admin.setUserPassword) {
    return { ok: false, error: "Neon staff administration is unavailable. Sign out, sign back in, and try again." };
  }

  const lookup = await findNeonUserByEmail(admin, email);
  if (!lookup.ok) return lookup;

  const tempPassword = generateTempPassword();
  let authUser = lookup.data;
  let createdHere = false;

  if (!authUser) {
    try {
      const { data, error } = await admin.createUser({
        email,
        password: tempPassword,
        name: fullName,
        role: input.role === "manager" ? "admin" : "user",
      });
      if (error || !data?.user?.id) {
        return { ok: false, error: authErrorMessage(error, "Could not create the Neon login.") };
      }
      authUser = data.user;
      createdHere = true;
    } catch (error) {
      return { ok: false, error: authErrorMessage(error, "Could not create the Neon login.") };
    }
  }

  const { error: profileError } = await service.from("chillbros_profiles").insert({
    id: authUser.id,
    auth_user_id: authUser.id,
    full_name: fullName,
    email,
    role: input.role,
    status: "active",
  });
  if (profileError) {
    if (createdHere && admin.removeUser) await admin.removeUser({ userId: authUser.id }).catch(() => undefined);
    return { ok: false, error: profileError.message };
  }

  if (!createdHere) {
    try {
      const { error } = await admin.setUserPassword({ userId: authUser.id, newPassword: tempPassword });
      if (error) {
        await service.from("chillbros_profiles").delete().eq("id", authUser.id);
        return { ok: false, error: authErrorMessage(error, "Could not set the Neon password.") };
      }
    } catch (error) {
      await service.from("chillbros_profiles").delete().eq("id", authUser.id);
      return { ok: false, error: authErrorMessage(error, "Could not set the Neon password.") };
    }
  }

  if (input.role === "manager" && admin.setRole) {
    const { error } = await admin.setRole({ userId: authUser.id, role: "admin" });
    if (error) {
      await service.from("chillbros_profiles").delete().eq("id", authUser.id);
      if (createdHere && admin.removeUser) await admin.removeUser({ userId: authUser.id }).catch(() => undefined);
      return { ok: false, error: authErrorMessage(error, "Manager access could not be enabled in Neon Auth.") };
    }
  }

  revalidatePath("/manager");
  revalidatePath("/create");
  return { ok: true, data: { tempPassword } };
}

export async function resetStaffPasswordAction(staffId: string): Promise<ActionResult<{ tempPassword: string }>> {
  const guard = await requireCredentialAdministrator();
  if (!guard.ok) return guard;
  if (!staffId) return { ok: false, error: "Employee account is required." };

  const service = createServiceRoleClient();
  const { data: member, error: readError } = await service
    .from("chillbros_profiles")
    .select("auth_user_id,email,status")
    .eq("id", staffId)
    .maybeSingle();

  if (readError || !member?.email) return { ok: false, error: "Employee account not found." };
  if (member.status !== "active") return { ok: false, error: "Activate this employee before resetting the password." };

  const admin = neonAdmin();
  if (!admin?.setUserPassword) {
    return { ok: false, error: "Neon password administration is unavailable. Sign out, sign back in, and try again." };
  }

  let authUserId = typeof member.auth_user_id === "string" ? member.auth_user_id : "";
  if (!authUserId) {
    const lookup = await findNeonUserByEmail(admin, String(member.email).trim().toLowerCase());
    if (!lookup.ok) return lookup;
    if (!lookup.data) return { ok: false, error: "This employee has no Neon login yet. Re-create the login from Staff Accounts." };
    authUserId = lookup.data.id;
    const { error: linkError } = await service.from("chillbros_profiles").update({ auth_user_id: authUserId }).eq("id", staffId);
    if (linkError) return { ok: false, error: "The Neon login was found, but it could not be linked to this employee." };
  }

  const tempPassword = generateTempPassword();
  try {
    const { error } = await admin.setUserPassword({ userId: authUserId, newPassword: tempPassword });
    if (error) return { ok: false, error: authErrorMessage(error, "Could not reset the Neon password.") };
  } catch (error) {
    return { ok: false, error: authErrorMessage(error, "Could not reset the Neon password.") };
  }

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

  const { data: current } = await supabase
    .from("chillbros_invoices")
    .select("id,job_id,status,payment_status,revoked_at,portal_token")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!current || current.revoked_at || current.status === "void" || current.payment_status === "paid") {
    return { ok: false, error: "Paid or already-revoked estimates cannot be revoked." };
  }

  let restoreStandaloneInventory = false;
  if (current.job_id) {
    const { data: helperJob } = await supabase
      .from("chillbros_jobs")
      .select("scheduled_window")
      .eq("id", current.job_id)
      .maybeSingle();
    restoreStandaloneInventory = String(helperJob?.scheduled_window ?? "").startsWith("Standalone invoice ·");
  }

  const revokedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("chillbros_invoices")
    .update({ status: "void", revoked_at: revokedAt, revoked_by: guard.profile.id })
    .eq("id", invoiceId)
    .is("revoked_at", null)
    .neq("status", "void")
    .neq("payment_status", "paid")
    .select("id, portal_token, job_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Paid or already-revoked estimates cannot be revoked." };

  if (restoreStandaloneInventory && data.job_id) {
    const { data: parts } = await supabase.from("chillbros_job_parts").select("id").eq("job_id", data.job_id);
    for (const part of parts ?? []) {
      await supabase.rpc("chillbros_set_job_part_quantity", { p_job_part_id: part.id, p_quantity: 0 });
    }
    await supabase.from("chillbros_workflow_events").insert({
      job_id: data.job_id,
      invoice_id: invoiceId,
      actor_id: guard.profile.id,
      stage: "inventory_restored",
      message: "Standalone invoice revoked. Allocated inventory was returned to stock.",
    });
  }

  for (const path of ["/manager", "/technician", "/invoices", "/inventory", "/reports", `/portal/${data.portal_token}`]) revalidatePath(path);
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
