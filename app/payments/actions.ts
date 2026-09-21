"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { archiveInvoicePdf } from "@/lib/chillbros/invoice-pdf";
import { createReceiptForPaidInvoice } from "@/lib/chillbros/billing-receipts";
import { sendInvoicePaidNotification } from "@/lib/chillbros/approval-notifications";
import { getInvoiceV2ById, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

const METHODS = new Set(["cash", "check", "ach", "cash_app", "venmo", "zelle", "apple_pay", "card"]);

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function recordFullPaymentAction(formData: FormData): Promise<never> {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/sign-in");

  const invoiceId = text(formData, "invoiceId");
  const method = text(formData, "method");
  const reference = text(formData, "reference");
  const payerName = text(formData, "payerName");
  const cardLast4 = text(formData, "cardLast4");
  const notes = text(formData, "notes");
  const paidAtRaw = text(formData, "paidAt");

  if (!invoiceId || !METHODS.has(method)) redirect("/payments?error=Choose+a+valid+invoice+and+payment+method.");
  if (reference.length > 120 || payerName.length > 160 || notes.length > 1000) redirect("/payments?error=Payment+details+are+too+long.");
  if (method === "card" && cardLast4 && !/^\d{4}$/.test(cardLast4)) redirect(`/payments?invoice=${encodeURIComponent(invoiceId)}&error=Card+last+four+must+be+4+digits.`);

  const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();
  if (Number.isNaN(paidAt.getTime())) redirect(`/payments?invoice=${encodeURIComponent(invoiceId)}&error=Enter+a+valid+payment+date.`);

  const supabase = createServiceRoleClient();
  const { data: invoice, error: readError } = await supabase
    .from("chillbros_invoices")
    .select("id,invoice_number,status,payment_status,job_id,portal_token")
    .eq("id", invoiceId)
    .is("revoked_at", null)
    .maybeSingle();

  if (readError || !invoice) redirect("/payments?error=Invoice+not+found.");
  if (invoice.status !== "approved") redirect(`/payments?invoice=${encodeURIComponent(invoiceId)}&error=Only+approved+invoices+can+be+recorded+as+paid.`);
  if (invoice.payment_status === "paid") redirect(`/payments?invoice=${encodeURIComponent(invoiceId)}&error=This+invoice+is+already+paid.`);

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("chillbros_invoices")
    .update({
      payment_method: method,
      payment_status: "paid",
      paid_at: paidAt.toISOString(),
      paid_recorded_by: profile.id,
      updated_at: now,
    })
    .eq("id", invoiceId)
    .eq("status", "approved")
    .neq("payment_status", "paid")
    .select("id")
    .maybeSingle();

  if (updateError || !updated) redirect(`/payments?invoice=${encodeURIComponent(invoiceId)}&error=Payment+could+not+be+recorded.`);

  const receipt = await createReceiptForPaidInvoice(invoiceId, profile.id);
  await supabase.from("chillbros_receipts").update({
    payment_reference: reference || null,
    payer_name: payerName || null,
    card_last4: method === "card" ? cardLast4 || null : null,
    payment_notes: notes || null,
  }).eq("id", receipt.id);

  await supabase.from("chillbros_workflow_events").insert({
    job_id: invoice.job_id,
    invoice_id: invoiceId,
    actor_id: profile.id,
    stage: "paid",
    message: `Full payment recorded by manager via ${method.replace(/_/g, " ")}${reference ? ` · Ref ${reference}` : ""}.`,
  });

  try {
    const fullInvoice = await getInvoiceV2ById(invoiceId);
    if (fullInvoice) await sendInvoicePaidNotification({ invoiceNumber: fullInvoice.invoiceNumber, customerName: fullInvoice.customerName, amount: invoiceTotals(fullInvoice).total, method, invoiceId });
  } catch (error) { console.error("[record-payment] owner paid notification failed", error); }

  try { await archiveInvoicePdf(invoiceId, "paid"); } catch { /* payment remains authoritative */ }
  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath("/reports");
  revalidatePath("/");
  revalidatePath(`/portal/${invoice.portal_token}`);
  revalidatePath(`/portal/${invoice.portal_token}/receipt`);
  redirect(`/payments?invoice=${encodeURIComponent(invoiceId)}&success=Payment+recorded+and+receipt+generated.`);
}
