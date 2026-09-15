"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/server";
import { sendApprovalNotification } from "@/lib/chillbros/approval-notifications";
import { sendBillingDelivery } from "@/lib/chillbros/billing-delivery";
import { createReceiptForPaidInvoice } from "@/lib/chillbros/billing-receipts";
import { simpleDocumentNumber } from "@/lib/chillbros/document-number";
import { archiveInvoicePdf } from "@/lib/chillbros/invoice-pdf";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient, createUserScopedDataClient } from "@/lib/supabase/service-client";
import type { AdjustmentType, PaymentMethod, PaymentTerms } from "./types";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type EstimateDraftLine = { label: string; description?: string; quantity: number; unitPrice: number; taxable?: boolean };
export type EstimateAdjustments = { discountType: AdjustmentType | null; discountValue: number; downPaymentType: AdjustmentType | null; downPaymentValue: number; taxRate?: number };
type EstimateRpcRow = { estimate_id: string; estimate_number: string; estimate_token: string };

const PAYMENT_METHODS = new Set<PaymentMethod>(["cash", "check", "ach", "cash_app", "venmo", "zelle"]);
const ADJUSTMENT_TYPES = new Set<AdjustmentType>(["percent", "dollar"]);

function refresh(paths: string[]) { for (const path of paths) revalidatePath(path); }
function estimateNumber() { return simpleDocumentNumber("estimate"); }

function validateLines(lines: EstimateDraftLine[]) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 20) return { ok: false as const, error: "Add between 1 and 20 line items." };
  const clean: Required<EstimateDraftLine>[] = [];
  let subtotal = 0;
  let taxableSubtotal = 0;
  for (const row of lines) {
    const label = String(row.label ?? "").trim();
    const description = String(row.description ?? "").trim();
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unitPrice);
    const taxable = Boolean(row.taxable);
    if (!label || label.length > 200 || description.length > 1000 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000) return { ok: false as const, error: "Check line item name, description, quantity, and unit price." };
    const amount = Math.round(quantity * unitPrice * 100) / 100;
    if (amount > 100000) return { ok: false as const, error: "Each line item total must be $100,000 or less." };
    subtotal += amount;
    if (taxable) taxableSubtotal += amount;
    clean.push({ label, description, quantity, unitPrice, taxable });
  }
  if (subtotal <= 0 || subtotal > 250000) return { ok: false as const, error: "Estimate subtotal must be between $0.01 and $250,000." };
  return { ok: true as const, lines: clean, subtotal, taxableSubtotal };
}

function calcAdjustments(subtotal: number, taxableSubtotal: number, input: EstimateAdjustments, fallbackTaxRate = 0) {
  if (input.discountType !== null && !ADJUSTMENT_TYPES.has(input.discountType)) return { ok: false as const, error: "Choose a valid discount type." };
  if (input.downPaymentType !== null && !ADJUSTMENT_TYPES.has(input.downPaymentType)) return { ok: false as const, error: "Choose a valid down-payment type." };
  const discountValue = Number(input.discountValue || 0);
  const downPaymentValue = Number(input.downPaymentValue || 0);
  const taxRate = Number(input.taxRate ?? fallbackTaxRate ?? 0);
  if (!Number.isFinite(discountValue) || discountValue < 0 || !Number.isFinite(downPaymentValue) || downPaymentValue < 0) return { ok: false as const, error: "Discount and down-payment values must be valid nonnegative numbers." };
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 25) return { ok: false as const, error: "Tax rate must be between 0% and 25%." };
  if (input.discountType === "percent" && discountValue > 100) return { ok: false as const, error: "Discount percentage cannot exceed 100%." };
  if (input.downPaymentType === "percent" && downPaymentValue > 100) return { ok: false as const, error: "Down payment percentage cannot exceed 100%." };
  const discountAmount = input.discountType === "percent" ? subtotal * discountValue / 100 : input.discountType === "dollar" ? Math.min(discountValue, subtotal) : 0;
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxableAfterDiscount = subtotal > 0 ? Math.max(0, taxableSubtotal - discountAmount * (taxableSubtotal / subtotal)) : 0;
  const taxAmount = taxableAfterDiscount * taxRate / 100;
  const total = afterDiscount + taxAmount;
  const downPaymentAmount = input.downPaymentType === "percent" ? total * downPaymentValue / 100 : input.downPaymentType === "dollar" ? Math.min(downPaymentValue, total) : 0;
  return { ok: true as const, discountAmount: Math.round(discountAmount * 100) / 100, downPaymentAmount: Math.round(downPaymentAmount * 100) / 100, taxAmount: Math.round(taxAmount * 100) / 100, taxRate, total };
}

async function canEditEstimateJob(jobId: string) {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (profile.role === "manager") return { ok: true as const, profile };
  if (profile.role !== "technician") return { ok: false as const, error: "Estimate pricing is restricted to manager and assigned technician accounts." };
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_jobs").select("id").eq("id", jobId).eq("assigned_tech_id", profile.id).in("status", ["scheduled", "in_progress"]).maybeSingle();
  if (!data) return { ok: false as const, error: "This job is not assigned to you or is no longer active." };
  return { ok: true as const, profile };
}

export async function createEstimateV2Action(jobId: string, lines: EstimateDraftLine[], notes: string, adjustments: EstimateAdjustments): Promise<Result<{ estimateId: string; estimateNumber: string; portalToken: string }>> {
  const allowed = await canEditEstimateJob(jobId);
  if (!allowed.ok) return allowed;
  const checked = validateLines(lines);
  if (!checked.ok) return checked;
  const cleanNotes = String(notes ?? "").trim();
  if (cleanNotes.length > 2000) return { ok: false, error: "Customer notes must be 2,000 characters or fewer." };
  const calc = calcAdjustments(checked.subtotal, checked.taxableSubtotal, adjustments);
  if (!calc.ok) return calc;

  const authWithToken = auth as unknown as {
    token?: () => Promise<{ data?: unknown; error?: unknown }>;
  };
  const tokenResult = authWithToken.token ? await authWithToken.token() : null;
  const tokenData = tokenResult?.data;
  const accessToken = typeof tokenData === "string"
    ? tokenData
    : tokenData && typeof tokenData === "object" && "token" in tokenData && typeof (tokenData as { token?: unknown }).token === "string"
      ? (tokenData as { token: string }).token
      : "";
  if (!accessToken || tokenResult?.error) return { ok: false, error: "Your Neon session expired. Sign in and try again." };

  const userData = createUserScopedDataClient(accessToken);
  const number = estimateNumber();
  const { data, error } = await userData.rpc("chillbros_create_estimate_v2", {
    p_job_id: jobId,
    p_invoice_number: number,
    p_notes: cleanNotes || null,
    p_line_items: checked.lines.map((line) => ({ label: line.label, description: line.description || null, quantity: line.quantity, unit_price: line.unitPrice, taxable: line.taxable })),
    p_adjustments: { discount_type: adjustments.discountType, discount_value: Number(adjustments.discountValue || 0), down_payment_type: adjustments.downPaymentType, down_payment_value: Number(adjustments.downPaymentValue || 0), tax_rate: Number(adjustments.taxRate ?? 0) },
  }).single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "This job already has an active estimate." : error?.message ?? "Could not create estimate." };

  const row = data as unknown as EstimateRpcRow;
  const supabase = createServiceRoleClient();
  await supabase.from("chillbros_workflow_events").insert({ job_id: jobId, invoice_id: row.estimate_id, actor_id: allowed.profile.id, stage: "estimate_published", message: "Estimate published. Customer approval is the next step." });
  try { await sendBillingDelivery(row.estimate_id, "estimate", "email"); } catch {}
  refresh(["/technician", "/manager", "/dispatch", "/office", "/invoices", "/"]);
  return { ok: true, data: { estimateId: row.estimate_id, estimateNumber: row.estimate_number, portalToken: row.estimate_token } };
}

export async function updateEstimateAdjustmentsAction(invoiceId: string, adjustments: EstimateAdjustments): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!["manager", "technician"].includes(profile.role)) return { ok: false, error: "Pricing changes are restricted to manager and assigned technician accounts." };

  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase.from("chillbros_invoices").select("id,job_id,customer_id,status,revoked_at,portal_token,tax_rate").eq("id", invoiceId).maybeSingle();
  if (!invoice || invoice.revoked_at || invoice.status === "void") return { ok: false, error: "Estimate is not active." };
  if (invoice.status === "approved") return { ok: false, error: "Approved estimates are locked. Create a credit/refund adjustment instead of changing signed pricing." };

  if (profile.role === "technician") {
    const { data: job } = await supabase.from("chillbros_jobs").select("id").eq("id", invoice.job_id).eq("assigned_tech_id", profile.id).in("status", ["scheduled", "in_progress"]).maybeSingle();
    if (!job) return { ok: false, error: "This estimate is not on your active assigned job." };
  }

  const [{ data: rows }, { data: customer }] = await Promise.all([
    supabase.from("chillbros_invoice_line_items").select("amount,taxable").eq("invoice_id", invoiceId),
    supabase.from("chillbros_customers").select("tax_exempt").eq("id", invoice.customer_id).maybeSingle(),
  ]);
  const subtotal = (rows ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const taxableSubtotal = (rows ?? []).filter((row) => row.taxable).reduce((sum, row) => sum + Number(row.amount), 0);
  const requestedTaxRate = customer?.tax_exempt ? 0 : Number(adjustments.taxRate ?? invoice.tax_rate ?? 0);
  const calc = calcAdjustments(subtotal, taxableSubtotal, { ...adjustments, taxRate: requestedTaxRate }, requestedTaxRate);
  if (!calc.ok) return calc;

  const { error } = await supabase.from("chillbros_invoices").update({ discount_type: adjustments.discountType, discount_value: Number(adjustments.discountValue || 0), discount_amount: calc.discountAmount, down_payment_type: adjustments.downPaymentType, down_payment_value: Number(adjustments.downPaymentValue || 0), down_payment_amount: calc.downPaymentAmount, tax_rate: calc.taxRate, taxable_subtotal: taxableSubtotal, tax_amount: calc.taxAmount, updated_at: new Date().toISOString() }).eq("id", invoiceId);
  if (error) return { ok: false, error: error.message };
  await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.job_id, invoice_id: invoiceId, actor_id: profile.id, stage: "pricing_updated", message: "Discount/down-payment/tax terms updated." });
  refresh(["/technician", "/manager", "/dispatch", "/office", "/invoices", `/portal/${invoice.portal_token}`]);
  return { ok: true, data: undefined };
}

async function activeInvoiceByToken(token: string) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_invoices").select("id,job_id,customer_id,invoice_number,status,payment_status,revoked_at,payment_terms,due_at").eq("portal_token", token).is("revoked_at", null).neq("status", "void").maybeSingle();
  return data ?? null;
}

function approvalDueAt(terms: PaymentTerms, currentDueAt: string | null, now: Date) {
  if (terms === "custom" && currentDueAt) return currentDueAt;
  const days = terms === "net_7" ? 7 : terms === "net_15" ? 15 : terms === "net_30" ? 30 : 0;
  const due = new Date(now);
  due.setUTCDate(due.getUTCDate() + days);
  return due.toISOString();
}

export async function approveInvoiceV2Action(token: string, signatureName: string): Promise<Result> {
  const name = String(signatureName ?? "").trim();
  if (name.length < 2 || name.length > 200) return { ok: false, error: "Type a valid name between 2 and 200 characters to approve." };
  const invoice = await activeInvoiceByToken(token);
  if (!invoice) return { ok: false, error: "This secure link is no longer active." };
  if (invoice.status === "approved") return { ok: true, data: undefined };
  if (invoice.status !== "awaiting_approval") return { ok: false, error: "This estimate cannot be approved right now." };

  const supabase = createServiceRoleClient();
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const dueAt = approvalDueAt((invoice.payment_terms ?? "due_on_receipt") as PaymentTerms, invoice.due_at, nowDate);
  const { data, error } = await supabase.from("chillbros_invoices").update({ status: "approved", signature_name: name, signed_at: now, issued_at: now, due_at: dueAt, updated_at: now }).eq("id", invoice.id).eq("status", "awaiting_approval").is("revoked_at", null).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Approval could not be recorded." };
  await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.job_id, invoice_id: invoice.id, stage: "approved", message: `Customer approved estimate as ${name}. Invoice issued.` });
  const { data: customer } = await supabase.from("chillbros_customers").select("name").eq("id", invoice.customer_id).maybeSingle();
  await sendApprovalNotification({ subject: `Chill Bros approval · ${invoice.invoice_number}`, documentLabel: "Estimate / invoice", documentNumber: invoice.invoice_number, signedBy: name, customerName: customer?.name ?? null, relatedInvoiceId: invoice.id });
  try { await archiveInvoicePdf(invoice.id, "approved"); } catch {}
  try { await sendBillingDelivery(invoice.id, "invoice", "email"); } catch {}
  refresh(["/manager", "/dispatch", "/technician", "/office", "/invoices", "/reports", "/", `/portal/${token}`, `/portal/${token}/document`]);
  return { ok: true, data: undefined };
}

export async function setInvoicePaymentMethodV2Action(token: string, method: PaymentMethod): Promise<Result> {
  if (!PAYMENT_METHODS.has(method)) return { ok: false, error: "Choose a valid payment method." };
  const invoice = await activeInvoiceByToken(token);
  if (!invoice) return { ok: false, error: "This secure link is no longer active." };
  if (invoice.status !== "approved") return { ok: false, error: "Approve the estimate before selecting a payment method." };
  if (invoice.payment_status === "paid") return { ok: false, error: "Payment is already recorded." };

  const supabase = createServiceRoleClient();
  const { data: updated, error } = await supabase.from("chillbros_invoices").update({ payment_method: method, payment_status: "pending_manual_review", updated_at: new Date().toISOString() }).eq("id", invoice.id).eq("status", "approved").is("revoked_at", null).neq("payment_status", "paid").select("id").maybeSingle();
  if (error || !updated) return { ok: false, error: error?.message ?? "This invoice changed before the payment method could be saved." };
  await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.job_id, invoice_id: invoice.id, stage: "payment_method_selected", message: `Customer selected ${method.replace(/_/g, " ")} for payment.` });
  refresh(["/manager", "/dispatch", "/office", "/invoices", `/portal/${token}`, `/portal/${token}/document`]);
  return { ok: true, data: undefined };
}

export async function markInvoicePaidV2Action(invoiceId: string): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") return { ok: false, error: "Manager access required." };
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("chillbros_invoices").update({ payment_status: "paid", paid_at: now, paid_recorded_by: profile.id, updated_at: now }).eq("id", invoiceId).eq("status", "approved").is("revoked_at", null).neq("payment_status", "paid").select("id,job_id,portal_token").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Only an approved active invoice can be marked paid." };
  await supabase.from("chillbros_workflow_events").insert({ job_id: data.job_id, invoice_id: invoiceId, actor_id: profile.id, stage: "paid", message: "Manager recorded full payment. Billing workflow complete." });
  try { await createReceiptForPaidInvoice(invoiceId, profile.id); } catch {}
  try { await archiveInvoicePdf(invoiceId, "paid", profile.id); } catch {}
  try { await sendBillingDelivery(invoiceId, "receipt", "email"); } catch {}
  refresh(["/manager", "/dispatch", "/technician", "/office", "/invoices", "/reports", "/crm", "/", `/portal/${data.portal_token}`, `/portal/${data.portal_token}/receipt`]);
  return { ok: true, data: undefined };
}
