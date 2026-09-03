"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import type { PaymentMethod, StaffRole } from "./types";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function requireManager() {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (profile.role !== "manager") return { ok: false as const, error: "Manager access required." };
  return { ok: true as const, profile };
}

function generateTempPassword(): string {
  return randomBytes(9).toString("base64url");
}

export async function addStaffAccountAction(input: { fullName: string; email: string; role: StaffRole }): Promise<ActionResult<{ tempPassword: string }>> {
  const guard = await requireManager();
  if (!guard.ok) return guard;

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  if (!fullName || !email) return { ok: false, error: "Name and email are required." };

  const supabase = createServiceRoleClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return { ok: false, error: createError?.message ?? "Could not create the account." };
  }

  const { error: profileError } = await supabase.from("chillbros_profiles").insert({
    id: created.user.id,
    full_name: fullName,
    email,
    role: input.role,
    status: "active",
  });
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

  const supabase = createServiceRoleClient();
  const { data: profile, error: readError } = await supabase.from("chillbros_profiles").select("status").eq("id", staffId).maybeSingle();
  if (readError || !profile) return { ok: false, error: "Account not found." };

  const nextStatus = profile.status === "active" ? "inactive" : "active";
  const { error } = await supabase.from("chillbros_profiles").update({ status: nextStatus }).eq("id", staffId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/manager");
  return { ok: true, data: undefined };
}

export async function clockInAction(location: string): Promise<ActionResult<{ timesheetId: string; clockInAt: string }>> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("chillbros_timesheets")
    .insert({ technician_id: profile.id, location, clock_in_at: new Date().toISOString() })
    .select("id, clock_in_at")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not clock in." };

  await supabase.from("chillbros_profiles").update({ last_clock_event: `Clocked in ${new Date(data.clock_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` }).eq("id", profile.id);

  revalidatePath("/timesheet");
  return { ok: true, data: { timesheetId: data.id, clockInAt: data.clock_in_at } };
}

export async function clockOutAction(timesheetId: string, laborHours: number, driveHours: number): Promise<ActionResult<{ clockOutAt: string }>> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = createServiceRoleClient();
  const clockOutAt = new Date().toISOString();
  const { error } = await supabase
    .from("chillbros_timesheets")
    .update({ clock_out_at: clockOutAt, labor_hours: laborHours, drive_hours: driveHours })
    .eq("id", timesheetId)
    .eq("technician_id", profile.id);
  if (error) return { ok: false, error: error.message };

  await supabase.from("chillbros_profiles").update({ last_clock_event: `Clocked out ${new Date(clockOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` }).eq("id", profile.id);

  revalidatePath("/timesheet");
  return { ok: true, data: { clockOutAt } };
}

// --- Client portal actions (token-authenticated, no login) ---

async function loadInvoiceByToken(token: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_invoices").select("id, status").eq("portal_token", token).maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function approveInvoiceAction(token: string, signatureName: string): Promise<ActionResult> {
  const name = signatureName.trim();
  if (!name) return { ok: false, error: "A signature is required." };

  const invoice = await loadInvoiceByToken(token);
  if (!invoice) return { ok: false, error: "Invoice not found." };

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("chillbros_invoices")
    .update({ status: "approved", signature_name: name, signed_at: new Date().toISOString() })
    .eq("id", invoice.id);
  if (error) return { ok: false, error: error.message };

  await supabase.from("chillbros_email_log").insert({
    subject: `Customer approval received • ${token.slice(0, 8)}`,
    recipients: "owner@chillbros.local, chillbrostx@gmail.com",
    related_invoice_id: invoice.id,
    status: "queued",
  });

  revalidatePath(`/portal/${token}`);
  return { ok: true, data: undefined };
}

export async function setInvoicePaymentMethodAction(token: string, method: PaymentMethod): Promise<ActionResult> {
  const invoice = await loadInvoiceByToken(token);
  if (!invoice) return { ok: false, error: "Invoice not found." };

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("chillbros_invoices")
    .update({ payment_method: method, payment_status: "pending_manual_review" })
    .eq("id", invoice.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/portal/${token}`);
  return { ok: true, data: undefined };
}

export async function markInvoicePaidAction(invoiceId: string): Promise<ActionResult> {
  const guard = await requireManager();
  if (!guard.ok) return guard;

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("chillbros_invoices")
    .update({ payment_status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/manager");
  revalidatePath("/crm");
  return { ok: true, data: undefined };
}

export async function uploadJobPhotoAction(jobId: string, phase: "before" | "after", file: File): Promise<ActionResult> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!file || file.size === 0) return { ok: false, error: "Choose a photo first." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Photo is larger than 10MB." };

  const supabase = createServiceRoleClient();
  const extension = (file.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
  const path = `${jobId}/${phase}/${Date.now()}-${randomBytes(4).toString("hex")}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("chillbros-media").upload(path, file, { contentType: file.type });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { error: insertError } = await supabase.from("chillbros_job_photos").insert({
    job_id: jobId,
    phase,
    storage_path: path,
    uploaded_by: profile.id,
  });
  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath("/technician");
  return { ok: true, data: undefined };
}
