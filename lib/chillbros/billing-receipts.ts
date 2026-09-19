import "server-only";

import { randomBytes } from "node:crypto";

import { getInvoiceV2ById, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";

function receiptNumber() {
  const now = new Date();
  return `RCT-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${now.toISOString().slice(11, 19).replace(/:/g, "")}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export async function createReceiptForPaidInvoice(invoiceId: string, actorId: string | null) {
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase.from("chillbros_receipts").select("id,receipt_number,portal_token,amount,paid_at").eq("invoice_id", invoiceId).maybeSingle();
  if (existing) return existing;
  const invoice = await getInvoiceV2ById(invoiceId);
  if (!invoice || invoice.paymentStatus !== "paid") throw new Error("Receipt can only be created for a paid invoice.");
  const totals = invoiceTotals(invoice);
  const { data: paidRow } = await supabase.from("chillbros_invoices").select("paid_at").eq("id", invoiceId).maybeSingle();
  const paidAt = paidRow?.paid_at ?? new Date().toISOString();
  const { data, error } = await supabase.from("chillbros_receipts").insert({
    receipt_number: receiptNumber(),
    invoice_id: invoiceId,
    amount: totals.total,
    payment_method: invoice.paymentMethod,
    paid_at: paidAt,
    created_by: actorId,
  }).select("id,receipt_number,portal_token,amount,paid_at").single();
  if (error) {
    const { data: raced } = await supabase.from("chillbros_receipts").select("id,receipt_number,portal_token,amount,paid_at").eq("invoice_id", invoiceId).maybeSingle();
    if (raced) return raced;
    throw error;
  }
  return data;
}
