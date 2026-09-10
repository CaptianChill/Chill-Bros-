"use server";

import { revalidatePath } from "next/cache";

import { sendApprovalNotification } from "@/lib/chillbros/approval-notifications";
import { sendBillingDelivery } from "@/lib/chillbros/billing-delivery";
import { archiveInvoicePdf } from "@/lib/chillbros/invoice-pdf";
import { captureCompletedJobKnowledge } from "@/lib/chillbros/knowledge-cases";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type { PaymentMethod, PaymentTerms } from "./types";

type Result = { ok: true; data: undefined } | { ok: false; error: string };

const MANUAL_PAYMENT_METHODS = new Set<PaymentMethod>(["cash", "check", "ach", "cash_app", "venmo", "zelle"]);

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function refresh(jobId: string, token?: string | null) {
  const paths = ["/", "/manager", "/dispatch", "/office", "/technician", "/schedule", "/invoices", "/training", `/jobs/${jobId}`];
  if (token) paths.push(`/portal/${token}`, `/portal/${token}/document`);
  for (const path of paths) revalidatePath(path);
}

function dueAtFor(terms: PaymentTerms, currentDueAt: string | null, now: Date) {
  if (terms === "custom" && currentDueAt) return currentDueAt;
  const days = terms === "net_7" ? 7 : terms === "net_15" ? 15 : terms === "net_30" ? 30 : 0;
  const due = new Date(now);
  due.setUTCDate(due.getUTCDate() + days);
  return due.toISOString();
}

async function activeInvoiceByToken(token: string) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("chillbros_invoices")
    .select("id,job_id,customer_id,invoice_number,portal_token,status,payment_status,payment_terms,due_at,issued_at,revoked_at")
    .eq("portal_token", token)
    .is("revoked_at", null)
    .neq("status", "void")
    .maybeSingle();
  return data ?? null;
}

async function requireJobActor(jobId: string, allowOffice = false) {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false as const, error: "Sign in to continue." };
  if (profile.role === "manager" || (allowOffice && profile.role === "office")) return { ok: true as const, profile };
  if (profile.role !== "technician") return { ok: false as const, error: "You do not have permission to change this job." };
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_jobs").select("id").eq("id", jobId).eq("assigned_tech_id", profile.id).maybeSingle();
  if (!data) return { ok: false as const, error: "This job is not assigned to you." };
  return { ok: true as const, profile };
}

/** Customer approval only sells the work. It intentionally does not issue the final invoice. */
export async function approveEstimateLifecycleAction(token: string, signatureName: string): Promise<Result> {
  const name = String(signatureName ?? "").trim();
  if (name.length < 2 || name.length > 200) return { ok: false, error: "Type a valid name between 2 and 200 characters to approve." };

  const invoice = await activeInvoiceByToken(token);
  if (!invoice) return { ok: false, error: "This secure link is no longer active." };
  if (invoice.status === "approved") return { ok: true, data: undefined };
  if (invoice.status !== "awaiting_approval") return { ok: false, error: "This estimate cannot be approved right now." };

  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("chillbros_invoices")
    .update({ status: "approved", signature_name: name, signed_at: now, issued_at: null, due_at: null, updated_at: now })
    .eq("id", invoice.id)
    .eq("status", "awaiting_approval")
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Approval could not be recorded." };

  if (invoice.job_id) {
    await supabase
      .from("chillbros_jobs")
      .update({ status: "scheduled", scheduled_window: "Approved · needs scheduling", updated_at: now })
      .eq("id", invoice.job_id)
      .eq("status", "completed");
  }

  await supabase.from("chillbros_workflow_events").insert({
    job_id: invoice.job_id,
    invoice_id: invoice.id,
    stage: "approved_needs_action",
    message: `Customer approved estimate as ${name}. Work is sold; choose Work Now or schedule the return visit.`,
  });

  const { data: customer } = await supabase.from("chillbros_customers").select("name").eq("id", invoice.customer_id).maybeSingle();
  await sendApprovalNotification({
    subject: `Chill Bros estimate approved · ${invoice.invoice_number}`,
    documentLabel: "Estimate",
    documentNumber: invoice.invoice_number,
    signedBy: name,
    customerName: customer?.name ?? null,
    relatedInvoiceId: invoice.id,
  });
  try { await archiveInvoicePdf(invoice.id, "approved"); } catch {}
  if (invoice.job_id) refresh(invoice.job_id, token);
  return { ok: true, data: undefined };
}

export async function startApprovedWorkAction(formData: FormData): Promise<void> {
  const jobId = text(formData, "jobId");
  const invoiceId = text(formData, "invoiceId");
  if (!jobId || !invoiceId) return;
  const allowed = await requireJobActor(jobId);
  if (!allowed.ok) return;

  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase
    .from("chillbros_invoices")
    .select("id,job_id,status,issued_at,portal_token")
    .eq("id", invoiceId)
    .eq("job_id", jobId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!invoice || invoice.status !== "approved" || invoice.issued_at) return;

  const now = new Date().toISOString();
  await supabase.from("chillbros_jobs").update({ status: "in_progress", updated_at: now }).eq("id", jobId).neq("status", "cancelled");
  await supabase.from("chillbros_workflow_events").insert({
    job_id: jobId,
    invoice_id: invoiceId,
    actor_id: allowed.profile.id,
    stage: "approved_work_now",
    message: "Approved work started on the current visit.",
  });
  refresh(jobId, invoice.portal_token);
}

export async function scheduleReturnVisitAction(formData: FormData): Promise<void> {
  const jobId = text(formData, "jobId");
  const invoiceId = text(formData, "invoiceId");
  const date = text(formData, "date");
  const start = text(formData, "start");
  const end = text(formData, "end");
  const technicianId = text(formData, "technicianId");
  if (!jobId || !invoiceId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start >= end) return;

  const allowed = await requireJobActor(jobId, true);
  if (!allowed.ok || allowed.profile.role === "technician") return;

  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase
    .from("chillbros_invoices")
    .select("id,job_id,status,issued_at,portal_token")
    .eq("id", invoiceId)
    .eq("job_id", jobId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!invoice || invoice.status !== "approved" || invoice.issued_at) return;

  if (technicianId) {
    const { data: technician } = await supabase.from("chillbros_profiles").select("id").eq("id", technicianId).in("role", ["technician", "manager"]).eq("status", "active").maybeSingle();
    if (!technician) return;
  }

  const scheduledWindow = `${date} ${start}-${end} CT`;
  const update: Record<string, string | null> = { status: "scheduled", scheduled_window: scheduledWindow, updated_at: new Date().toISOString() };
  if (technicianId) update.assigned_tech_id = technicianId;
  await supabase.from("chillbros_jobs").update(update).eq("id", jobId).neq("status", "cancelled");
  await supabase.from("chillbros_workflow_events").insert({
    job_id: jobId,
    invoice_id: invoiceId,
    actor_id: allowed.profile.id,
    stage: "return_scheduled",
    message: `Return visit scheduled for ${date} ${start}-${end} CT on the same job.`,
  });
  refresh(jobId, invoice.portal_token);
}

export async function issueInvoiceForCompletedWorkAction(formData: FormData): Promise<void> {
  const jobId = text(formData, "jobId");
  const invoiceId = text(formData, "invoiceId");
  if (!jobId || !invoiceId) return;
  const allowed = await requireJobActor(jobId, true);
  if (!allowed.ok) return;

  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase
    .from("chillbros_invoices")
    .select("id,job_id,status,payment_status,payment_terms,due_at,issued_at,portal_token")
    .eq("id", invoiceId)
    .eq("job_id", jobId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!invoice || invoice.status !== "approved" || invoice.payment_status === "paid") return;
  if (invoice.issued_at) { refresh(jobId, invoice.portal_token); return; }

  const nowDate = new Date();
  const now = nowDate.toISOString();
  const dueAt = dueAtFor((invoice.payment_terms ?? "due_on_receipt") as PaymentTerms, invoice.due_at, nowDate);
  const { data: issued } = await supabase
    .from("chillbros_invoices")
    .update({ issued_at: now, due_at: dueAt, updated_at: now })
    .eq("id", invoiceId)
    .eq("status", "approved")
    .is("issued_at", null)
    .select("id")
    .maybeSingle();
  if (!issued) return;

  await supabase.from("chillbros_jobs").update({ status: "completed", updated_at: now }).eq("id", jobId).neq("status", "cancelled");
  await supabase.from("chillbros_workflow_events").insert({
    job_id: jobId,
    invoice_id: invoiceId,
    actor_id: allowed.profile.id,
    stage: "invoice_issued",
    message: "Work completed. Final invoice issued and payment is now due.",
  });
  try { await captureCompletedJobKnowledge(jobId, invoiceId, allowed.profile.id); } catch (error) { console.error("[tech-assist] completed job capture failed", error); }
  try { await sendBillingDelivery(invoiceId, "invoice", "email"); } catch {}
  try { await sendBillingDelivery(invoiceId, "invoice", "sms"); } catch {}
  refresh(jobId, invoice.portal_token);
}

export async function setIssuedInvoicePaymentMethodAction(token: string, method: PaymentMethod): Promise<Result> {
  if (!MANUAL_PAYMENT_METHODS.has(method)) return { ok: false, error: "Choose a valid payment method." };
  const invoice = await activeInvoiceByToken(token);
  if (!invoice) return { ok: false, error: "This secure payment link is no longer active." };
  if (invoice.status !== "approved") return { ok: false, error: "Approve the estimate before payment." };
  if (!invoice.issued_at) return { ok: false, error: "Payment is not due until Chill Bros completes the work and issues the invoice." };
  if (invoice.payment_status === "paid") return { ok: false, error: "Payment is already recorded." };

  const supabase = createServiceRoleClient();
  const { data: updated, error } = await supabase
    .from("chillbros_invoices")
    .update({ payment_method: method, payment_status: "pending_manual_review", updated_at: new Date().toISOString() })
    .eq("id", invoice.id)
    .eq("status", "approved")
    .not("issued_at", "is", null)
    .neq("payment_status", "paid")
    .select("id")
    .maybeSingle();
  if (error || !updated) return { ok: false, error: error?.message ?? "The payment method could not be saved." };

  await supabase.from("chillbros_workflow_events").insert({
    job_id: invoice.job_id,
    invoice_id: invoice.id,
    stage: "payment_method_selected",
    message: `Customer selected ${method.replace(/_/g, " ")} for payment.`,
  });
  if (invoice.job_id) refresh(invoice.job_id, token);
  return { ok: true, data: undefined };
}
