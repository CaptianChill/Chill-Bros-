"use server";

import { revalidatePath } from "next/cache";

import { archiveInvoicePdf } from "@/lib/chillbros/invoice-pdf";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export type RevisionLine = { label: string; description?: string; quantity: number; unitPrice: number; taxable?: boolean };
export type RevisionDownPayment = { type: "percent" | "dollar" | null; value: number };
type Result = { ok: true; data: { status: string; oldTotal: number; newTotal: number; downPaymentAmount: number; downPaymentPaid: boolean; warning?: string } } | { ok: false; error: string };

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const MAX_DOCUMENT_LINES = 40;

/**
 * Edit any unpaid quote or invoice in place — lines, notes, equipment, and
 * down payment — without reopening it. An invoice that was ready to pay stays
 * ready to pay; the customer's link shows the new amounts immediately.
 */
export async function reviseUnpaidDocumentAction(
  invoiceId: string,
  input: { lines: RevisionLine[]; notes: string; equipmentId?: string | null; downPayment: RevisionDownPayment },
): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) return { ok: false, error: "Owner or office access required." };
  if (!invoiceId) return { ok: false, error: "Document is required." };

  const lines = Array.isArray(input.lines) ? input.lines : [];
  if (lines.length < 1 || lines.length > MAX_DOCUMENT_LINES) return { ok: false, error: `Add between 1 and ${MAX_DOCUMENT_LINES} line items.` };
  const clean = [];
  for (const [index, row] of lines.entries()) {
    const label = String(row.label ?? "").trim();
    const description = String(row.description ?? "").trim();
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unitPrice);
    if (!label || label.length > 200 || description.length > 1000 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000) {
      return { ok: false, error: `Check line ${index + 1}: it needs a name, a quantity above 0, and a price.` };
    }
    clean.push({ label, description: description || null, quantity, unit_price: Math.round(unitPrice * 100) / 100, taxable: Boolean(row.taxable) });
  }
  const notes = String(input.notes ?? "").trim();
  if (notes.length > 2000) return { ok: false, error: "Customer notes must be 2,000 characters or fewer." };
  const dpType = input.downPayment?.type === "percent" || input.downPayment?.type === "dollar" ? input.downPayment.type : null;
  const dpValue = dpType ? Number(input.downPayment.value) : 0;
  if (!Number.isFinite(dpValue) || dpValue < 0 || (dpType === "percent" && dpValue > 100)) return { ok: false, error: "Check the down payment amount." };

  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase.from("chillbros_invoices").select("id,job_id,customer_id,portal_token,invoice_number,status,payment_status,revoked_at").eq("id", invoiceId).maybeSingle();
  if (!invoice || invoice.revoked_at || invoice.status === "void") return { ok: false, error: "This document is not active." };
  if (invoice.payment_status === "paid") return { ok: false, error: "Paid invoices are locked. Use a credit or refund." };

  if (input.equipmentId !== undefined && invoice.job_id) {
    if (input.equipmentId) {
      const { data: unit } = await supabase.from("chillbros_equipment").select("id,customer_id").eq("id", input.equipmentId).maybeSingle();
      if (!unit || unit.customer_id !== invoice.customer_id) return { ok: false, error: "That equipment doesn't belong to this customer." };
    }
    const { error } = await supabase.from("chillbros_jobs").update({ equipment_id: input.equipmentId || null, updated_at: new Date().toISOString() }).eq("id", invoice.job_id);
    if (error) return { ok: false, error: error.message };
  }

  const { data, error } = await supabase.rpc("chillbros_owner_revise_unpaid_document", {
    p_invoice_id: invoiceId,
    p_notes: notes || null,
    p_line_items: clean,
    p_down_payment_type: dpType,
    p_down_payment_value: dpValue,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Changes could not be saved." };
  const result = data as { status: string; old_total: number; new_total: number; down_payment_amount: number; down_payment_paid: boolean };
  const oldTotal = Number(result.old_total);
  const newTotal = Number(result.new_total);
  const downPaymentAmount = Number(result.down_payment_amount);

  await supabase.from("chillbros_workflow_events").insert({
    job_id: invoice.job_id,
    invoice_id: invoiceId,
    actor_id: profile.id,
    stage: "document_revised",
    message: `${profile.role === "manager" ? "Owner" : "Office"} edited ${invoice.invoice_number}: total ${money(oldTotal)} → ${money(newTotal)}${downPaymentAmount > 0 ? `, down payment ${money(downPaymentAmount)}${result.down_payment_paid ? " (already received)" : ""}` : ", no down payment"}. ${clean.length} line item${clean.length === 1 ? "" : "s"}.`,
  });

  let warning: string | undefined;
  if (result.status === "approved") {
    try { await archiveInvoicePdf(invoiceId, "approved", profile.id); }
    catch (cause) { warning = `Saved. The PDF copy will rebuild later (${cause instanceof Error ? cause.message : "PDF failed"}).`; }
  }

  for (const path of ["/invoices", "/payments", "/office", "/manager", "/reports", "/technician", "/dispatch", "/"]) revalidatePath(path);
  if (invoice.job_id) revalidatePath(`/jobs/${invoice.job_id}`);
  if (invoice.portal_token) for (const suffix of ["", "/document", "/receipt"]) revalidatePath(`/portal/${invoice.portal_token}${suffix}`);
  return { ok: true, data: { status: result.status, oldTotal, newTotal, downPaymentAmount, downPaymentPaid: Boolean(result.down_payment_paid), warning } };
}
