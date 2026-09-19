import "server-only";

import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";
import type { DetailedInvoice, WorkflowEvent } from "./types";

async function adjustmentTotals(invoiceId: string) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_invoice_adjustments").select("adjustment_type,amount").eq("invoice_id", invoiceId);
  let creditAmount = 0;
  let refundAmount = 0;
  for (const row of data ?? []) {
    if (row.adjustment_type === "credit") creditAmount += Number(row.amount ?? 0);
    if (row.adjustment_type === "refund") refundAmount += Number(row.amount ?? 0);
  }
  return { creditAmount, refundAmount };
}

export async function getInvoiceV2ByToken(token: string): Promise<DetailedInvoice | null> {
  const supabase = createServiceRoleClient();
  const { data: invoice, error } = await supabase.from("chillbros_invoices").select("id, invoice_number, portal_token, status, customer_id, job_id, signature_name, signed_at, payment_method, payment_status, notes, discount_type, discount_value, discount_amount, down_payment_type, down_payment_value, down_payment_amount, tax_rate, taxable_subtotal, tax_amount, issued_at, payment_terms, due_at, last_reminder_at, reminder_count, customer:chillbros_customers(name)").eq("portal_token", token).is("revoked_at", null).neq("status", "void").maybeSingle();
  if (error || !invoice) return null;
  const [{ data: lineItems }, adjustments] = await Promise.all([
    supabase.from("chillbros_invoice_line_items").select("id, label, description, quantity, unit_price, amount, taxable").eq("invoice_id", invoice.id).order("sort_order", { ascending: true }),
    adjustmentTotals(invoice.id),
  ]);
  const customer = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    portalToken: invoice.portal_token,
    status: invoice.status,
    customerId: invoice.customer_id,
    customerName: customer?.name ?? "Unknown customer",
    jobId: invoice.job_id,
    signatureName: invoice.signature_name,
    signedAt: invoice.signed_at,
    paymentMethod: invoice.payment_method,
    paymentStatus: invoice.payment_status,
    notes: invoice.notes,
    taxRate: Number(invoice.tax_rate ?? 0),
    taxableSubtotal: Number(invoice.taxable_subtotal ?? 0),
    taxAmount: Number(invoice.tax_amount ?? 0),
    issuedAt: invoice.issued_at,
    paymentTerms: invoice.payment_terms ?? "due_on_receipt",
    dueAt: invoice.due_at,
    lastReminderAt: invoice.last_reminder_at,
    reminderCount: Number(invoice.reminder_count ?? 0),
    creditAmount: adjustments.creditAmount,
    refundAmount: adjustments.refundAmount,
    discountType: invoice.discount_type,
    discountValue: Number(invoice.discount_value ?? 0),
    discountAmount: Number(invoice.discount_amount ?? 0),
    downPaymentType: invoice.down_payment_type,
    downPaymentValue: Number(invoice.down_payment_value ?? 0),
    downPaymentAmount: Number(invoice.down_payment_amount ?? 0),
    lineItems: (lineItems ?? []).map((item) => ({ id: item.id, label: item.label, description: item.description, quantity: Number(item.quantity ?? 1), unitPrice: Number(item.unit_price ?? item.amount), amount: Number(item.amount), taxable: Boolean(item.taxable) })),
  };
}

export async function getInvoiceV2ById(invoiceId: string): Promise<DetailedInvoice | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_invoices").select("portal_token").eq("id", invoiceId).maybeSingle();
  return data?.portal_token ? getInvoiceV2ByToken(data.portal_token) : null;
}

export async function getInvoiceV2ByJobId(jobId: string): Promise<DetailedInvoice | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_invoices").select("portal_token").eq("job_id", jobId).is("revoked_at", null).neq("status", "void").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return data ? getInvoiceV2ByToken(data.portal_token) : null;
}

export async function getWorkflowEvents(limit = 30): Promise<WorkflowEvent[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_workflow_events").select("id, job_id, invoice_id, stage, message, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error || !data) return [];
  return data.map((row) => ({ id: row.id, jobId: row.job_id, invoiceId: row.invoice_id, stage: row.stage, message: row.message, createdAt: row.created_at }));
}

export function invoiceTotals(invoice: DetailedInvoice) {
  const subtotal = invoice.lineItems.reduce((sum, item) => sum + item.amount, 0);
  const afterDiscount = Math.max(0, subtotal - invoice.discountAmount);
  const grossTotal = Math.max(0, afterDiscount + invoice.taxAmount);
  const total = Math.max(0, grossTotal - invoice.creditAmount);
  const balanceAfterDownPayment = Math.max(0, total - Math.min(invoice.downPaymentAmount, total));
  return { subtotal, afterDiscount, taxAmount: invoice.taxAmount, grossTotal, creditAmount: invoice.creditAmount, refundAmount: invoice.refundAmount, total, balanceAfterDownPayment };
}
