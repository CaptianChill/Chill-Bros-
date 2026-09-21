"use server";

import { revalidatePath } from "next/cache";

import { sendBillingDeliveryRecorded, type BillingDeliveryChannel } from "@/lib/chillbros/billing-delivery";
import { getInvoiceV2ById, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { archiveInvoicePdf, type ArchiveStage } from "@/lib/chillbros/invoice-pdf";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type { InvoiceAdjustmentType, PaymentTerms } from "@/lib/chillbros/types";
import { JOB_ACTIVE_STATUSES } from "@/lib/chillbros/types";
import { approvalDueAt } from "@/lib/chillbros/billing-terms";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; status?: string };
const TERMS = new Set<PaymentTerms>(["due_on_receipt", "net_7", "net_15", "net_30", "custom"]);
const ADJUSTMENTS = new Set<InvoiceAdjustmentType>(["credit", "refund"]);

async function requireOfficeOrManager() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) return { ok: false as const, error: "Office or manager access required." };
  return { ok: true as const, profile };
}

async function requireManager() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") return { ok: false as const, error: "Manager access required." };
  return { ok: true as const, profile };
}

function dueForTerms(terms: PaymentTerms, customDate: string | null, anchor: string | null) {
  if (terms === "custom") {
    const value = String(customDate || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T23:59:59.999Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const days = terms === "net_7" ? 7 : terms === "net_15" ? 15 : terms === "net_30" ? 30 : 0;
  const base = anchor ? new Date(anchor) : new Date();
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString();
}

function refreshInvoicePaths(portalToken?: string | null) {
  revalidatePath("/invoices");
  revalidatePath("/office");
  revalidatePath("/manager");
  revalidatePath("/reports");
  revalidatePath("/");
  if (portalToken) {
    revalidatePath(`/portal/${portalToken}`);
    revalidatePath(`/portal/${portalToken}/document`);
    revalidatePath(`/portal/${portalToken}/receipt`);
  }
}

export async function updateInvoiceBillingSettingsAction(invoiceId: string, input: { taxRate: number; paymentTerms: PaymentTerms; dueDate: string | null; taxExempt: boolean; taxExemptNote: string }): Promise<Result> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const taxRate = Number(input.taxRate);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 25) return { ok: false, error: "Tax rate must be between 0% and 25%." };
  if (!TERMS.has(input.paymentTerms)) return { ok: false, error: "Choose valid payment terms." };
  const taxExemptNote = String(input.taxExemptNote || "").trim();
  if (taxExemptNote.length > 500) return { ok: false, error: "Tax-exempt note must be 500 characters or fewer." };

  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase.from("chillbros_invoices").select("id,status,customer_id,job_id,portal_token,discount_amount,tax_rate,issued_at,payment_terms,due_at,revoked_at").eq("id", invoiceId).maybeSingle();
  if (!invoice || invoice.revoked_at || invoice.status === "void") return { ok: false, error: "Invoice is not active." };
  const { data: customer } = await supabase.from("chillbros_customers").select("tax_exempt,tax_exempt_note").eq("id", invoice.customer_id).maybeSingle();
  if (!customer) return { ok: false, error: "Customer record was not found." };

  const taxChanged = Math.abs(Number(invoice.tax_rate ?? 0) - taxRate) > 0.0001 || Boolean(customer.tax_exempt) !== Boolean(input.taxExempt);
  if (invoice.status === "approved" && taxChanged) return { ok: false, error: "Approved invoice tax is locked. Use a credit/refund adjustment instead of rewriting the signed invoice." };

  const dueAt = dueForTerms(input.paymentTerms, input.dueDate, invoice.issued_at);
  if (!dueAt) return { ok: false, error: "Choose a valid custom due date." };

  if (invoice.status !== "approved") {
    const { data: items } = await supabase.from("chillbros_invoice_line_items").select("amount,taxable").eq("invoice_id", invoiceId);
    const subtotal = (items ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const taxableSubtotal = (items ?? []).filter((row) => row.taxable).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const discount = Math.min(Number(invoice.discount_amount ?? 0), subtotal);
    const taxableAfterDiscount = subtotal > 0 ? Math.max(0, taxableSubtotal - discount * (taxableSubtotal / subtotal)) : 0;
    const effectiveRate = input.taxExempt ? 0 : taxRate;
    const taxAmount = Math.round(taxableAfterDiscount * effectiveRate) / 100;
    const { error: invoiceError } = await supabase.from("chillbros_invoices").update({ tax_rate: effectiveRate, taxable_subtotal: taxableSubtotal, tax_amount: taxAmount, payment_terms: input.paymentTerms, due_at: dueAt, updated_at: new Date().toISOString() }).eq("id", invoiceId);
    if (invoiceError) return { ok: false, error: invoiceError.message };
    const { error: customerError } = await supabase.from("chillbros_customers").update({ tax_exempt: Boolean(input.taxExempt), tax_exempt_note: taxExemptNote || null }).eq("id", invoice.customer_id);
    if (customerError) return { ok: false, error: customerError.message };
  } else {
    const { error } = await supabase.from("chillbros_invoices").update({ payment_terms: input.paymentTerms, due_at: dueAt, updated_at: new Date().toISOString() }).eq("id", invoiceId);
    if (error) return { ok: false, error: error.message };
  }

  await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.job_id, invoice_id: invoiceId, actor_id: guard.profile.id, stage: "billing_settings_updated", message: `Manager updated billing terms${invoice.status === "approved" ? "" : " and tax settings"}.` });
  refreshInvoicePaths(invoice.portal_token);
  return { ok: true, data: undefined };
}

export async function recordInvoiceAdjustmentAction(invoiceId: string, type: InvoiceAdjustmentType, amountInput: number, reasonInput: string): Promise<Result> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  if (!ADJUSTMENTS.has(type)) return { ok: false, error: "Choose credit or refund." };
  const amount = Math.round(Number(amountInput) * 100) / 100;
  const reason = String(reasonInput || "").trim();
  if (!Number.isFinite(amount) || amount <= 0 || amount > 250000) return { ok: false, error: "Adjustment amount must be greater than $0." };
  if (reason.length < 2 || reason.length > 1000) return { ok: false, error: "Enter a reason between 2 and 1,000 characters." };

  const invoice = await getInvoiceV2ById(invoiceId);
  if (!invoice) return { ok: false, error: "Active invoice was not found." };
  if (type === "credit" && invoice.paymentStatus === "paid") return { ok: false, error: "Use a refund for a paid invoice. Credits are for amounts still owed." };
  if (type === "refund" && invoice.paymentStatus !== "paid") return { ok: false, error: "Refunds can only be recorded after the invoice is paid." };
  const totals = invoiceTotals(invoice);
  const available = type === "credit" ? totals.total : Math.max(0, totals.total - invoice.refundAmount);
  if (amount > available + 0.001) return { ok: false, error: `${type === "credit" ? "Credit" : "Refund"} cannot exceed ${available.toLocaleString("en-US", { style: "currency", currency: "USD" })}.` };

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("chillbros_invoice_adjustments").insert({ invoice_id: invoiceId, adjustment_type: type, amount, reason, created_by: guard.profile.id });
  if (error) return { ok: false, error: error.message };
  await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.jobId, invoice_id: invoiceId, actor_id: guard.profile.id, stage: type === "credit" ? "credit_issued" : "refund_recorded", message: `${type === "credit" ? "Credit" : "Refund"} recorded: ${amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}. ${reason}`.slice(0, 1000) });
  refreshInvoicePaths(invoice.portalToken);
  return { ok: true, data: undefined };
}

export async function sendInvoiceCommunicationAction(invoiceId: string, channel: BillingDeliveryChannel, reminder = false): Promise<Result<{ status: string; recipient: string | null }>> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  if (channel !== "email" && channel !== "sms") return { ok: false, error: "Choose email or text delivery." };
  const invoice = await getInvoiceV2ById(invoiceId);
  if (!invoice) return { ok: false, error: "Active invoice was not found." };
  if (reminder && (invoice.status !== "approved" || invoice.paymentStatus === "paid")) return { ok: false, error: "Reminders are only for approved unpaid invoices." };
  const deliveryType = reminder ? "reminder" : invoice.paymentStatus === "paid" ? "receipt" : invoice.status === "approved" ? "invoice" : "estimate";
  const result = await sendBillingDeliveryRecorded(invoiceId, deliveryType, channel);
  if (result.status === "sent" && reminder) {
    const supabase = createServiceRoleClient();
    await supabase.from("chillbros_invoices").update({ last_reminder_at: new Date().toISOString(), reminder_count: invoice.reminderCount + 1, updated_at: new Date().toISOString() }).eq("id", invoiceId);
    await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.jobId, invoice_id: invoiceId, actor_id: guard.profile.id, stage: "payment_reminder_sent", message: `Payment reminder sent by ${channel}.` });
  }
  refreshInvoicePaths(invoice.portalToken);
  if (result.status !== "sent") return { ok: false, status: result.status, error: result.error ?? `${channel} delivery ${result.status}.` };
  if (channel === "email" && deliveryType === "invoice" && invoice.jobId) {
    const { error } = await createServiceRoleClient().from("chillbros_jobs").update({ status: "invoice_sent", updated_at: new Date().toISOString() }).eq("id", invoice.jobId).in("status", JOB_ACTIVE_STATUSES);
    if (error) return { ok: false, error: `Email sent to ${result.recipient}, but call status update failed: ${error.message}` };
    revalidatePath(`/jobs/${invoice.jobId}`);
    revalidatePath("/dispatch");
  }
  return { ok: true, data: { status: result.status, recipient: result.recipient } };
}

export async function finalizeInvoiceAction(invoiceId: string): Promise<Result> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  const supabase = createServiceRoleClient();
  const { data: invoice, error: readError } = await supabase.from("chillbros_invoices")
    .select("id,job_id,status,payment_status,payment_terms,due_at,issued_at,portal_token,revoked_at,updated_at").eq("id", invoiceId).maybeSingle();
  if (readError || !invoice) return { ok: false, error: readError?.message ?? "Invoice not found." };
  if (invoice.revoked_at || !["draft", "awaiting_approval"].includes(invoice.status) || invoice.payment_status === "paid") return { ok: false, error: `Cannot finalize invoice with status "${invoice.status}" and payment status "${invoice.payment_status}".` };
  const now = new Date();
  const { data: updated, error } = await supabase.from("chillbros_invoices").update({
    status: "approved", signature_name: "Approved by Chill Bros office", signed_at: now.toISOString(),
    issued_at: invoice.issued_at ?? now.toISOString(), due_at: approvalDueAt(invoice.payment_terms ?? "due_on_receipt", invoice.due_at, now), updated_at: now.toISOString(),
  }).eq("id", invoiceId).eq("status", invoice.status).eq("updated_at", invoice.updated_at).is("revoked_at", null).neq("payment_status", "paid").select("id").maybeSingle();
  if (error || !updated) return { ok: false, error: error?.message ?? "Invoice changed. Refresh before finalizing." };
  const { error: eventError } = await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.job_id, invoice_id: invoiceId, actor_id: guard.profile.id, stage: "invoice_finalized", message: "Approved by Chill Bros office. Finalized and held for review before it is sent to the customer." });
  refreshInvoicePaths(invoice.portal_token);
  if (eventError) return { ok: false, error: `Invoice finalized, but audit logging failed: ${eventError.message}` };
  return { ok: true, data: undefined };
}

export async function reopenInvoiceAction(invoiceId: string): Promise<Result> {
  const guard = await requireManager();
  if (!guard.ok) return guard;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_invoices")
    .update({ status: "awaiting_approval", signature_name: null, signed_at: null, updated_at: new Date().toISOString() })
    .eq("id", invoiceId).eq("status", "approved").eq("payment_status", "unpaid").is("revoked_at", null)
    .select("job_id,portal_token").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Only an approved unpaid invoice can be reopened. Paid invoices require credits/refunds." };
  const { error: eventError } = await supabase.from("chillbros_workflow_events").insert({ job_id: data.job_id, invoice_id: invoiceId, actor_id: guard.profile.id, stage: "invoice_reopened", message: "Manager reopened the unpaid invoice for price corrections." });
  refreshInvoicePaths(data.portal_token);
  if (eventError) return { ok: false, error: `Invoice reopened, but audit logging failed: ${eventError.message}` };
  return { ok: true, data: undefined };
}

export async function saveCustomerEmailAndSendAction(invoiceId: string, input: string): Promise<Result<{ status: string; recipient: string | null }>> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  const email = String(input ?? "").trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid customer email address." };
  const invoice = await getInvoiceV2ById(invoiceId);
  if (!invoice) return { ok: false, error: "Active invoice was not found." };
  const { data, error } = await createServiceRoleClient().from("chillbros_customers").update({ email }).eq("id", invoice.customerId).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Customer not found." };
  revalidatePath(`/customers/${invoice.customerId}`);
  revalidatePath("/customers");
  const result = await sendInvoiceCommunicationAction(invoiceId, "email");
  return result.ok ? result : { ...result, error: `Email saved. ${result.error}` };
}

export async function ensureInvoiceArchiveAction(invoiceId: string, stage: ArchiveStage): Promise<Result> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  const invoice = await getInvoiceV2ById(invoiceId);
  if (!invoice) return { ok: false, error: "Active invoice was not found." };
  if (stage === "approved" && invoice.status !== "approved") return { ok: false, error: "Only approved invoices can be archived." };
  if (stage === "paid" && invoice.paymentStatus !== "paid") return { ok: false, error: "Only paid invoices can have a paid archive." };
  try { await archiveInvoicePdf(invoiceId, stage, guard.profile.id); }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "PDF archive failed." }; }
  refreshInvoicePaths(invoice.portalToken);
  return { ok: true, data: undefined };
}
