import "server-only";

import { revalidatePath } from "next/cache";

import { sendBillingDeliveryRecorded, type BillingDeliveryChannel } from "@/lib/chillbros/billing-delivery";
import { getInvoiceV2ById } from "@/lib/chillbros/invoice-v2";
import { JOB_ACTIVE_STATUSES } from "@/lib/chillbros/types";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

// Sends a quote/invoice/reminder/receipt to the customer and records it.
// Shared by the signed-in staff action and the owner's command-center bridge.
// Callers are responsible for checking who is allowed to send.

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; status?: string };

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

export async function sendInvoiceCommunicationAs(actorId: string, invoiceId: string, channel: BillingDeliveryChannel, reminder = false, overrideRecipient?: string): Promise<Result<{ status: string; recipient: string | null }>> {
  if (channel !== "email" && channel !== "sms") return { ok: false, error: "Choose email or text delivery." };
  const recipient = String(overrideRecipient ?? "").trim().slice(0, 1000) || undefined;
  const invoice = await getInvoiceV2ById(invoiceId);
  if (!invoice) return { ok: false, error: "Active invoice was not found." };
  if (reminder && (invoice.status !== "approved" || invoice.paymentStatus === "paid")) return { ok: false, error: "Reminders are only for approved unpaid invoices." };
  const isQuote = invoice.invoiceNumber.toUpperCase().startsWith("Q-") || !invoice.issuedAt;
  const deliveryType = reminder ? "reminder" : invoice.paymentStatus === "paid" ? "receipt" : isQuote ? "estimate" : "invoice";
  const result = await sendBillingDeliveryRecorded(invoiceId, deliveryType, channel, recipient);
  if (result.status === "sent" && reminder) {
    const supabase = createServiceRoleClient();
    await supabase.from("chillbros_invoices").update({ last_reminder_at: new Date().toISOString(), reminder_count: invoice.reminderCount + 1, updated_at: new Date().toISOString() }).eq("id", invoiceId);
    await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.jobId, invoice_id: invoiceId, actor_id: actorId, stage: "payment_reminder_sent", message: `Payment reminder sent by ${channel}.` });
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
