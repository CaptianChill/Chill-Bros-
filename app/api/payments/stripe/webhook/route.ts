import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { createReceiptForPaidInvoice } from "@/lib/chillbros/billing-receipts";
import { archiveInvoicePdf } from "@/lib/chillbros/invoice-pdf";
import { getInvoiceV2ById, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { verifyStripeSignature } from "@/lib/chillbros/stripe";
import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";

export const runtime = "nodejs";

type StripeSession = {
  id: string;
  payment_intent?: string | null;
  payment_status?: string;
  amount_total?: number | null;
  payment_method_types?: string[];
  metadata?: { invoice_id?: string; portal_token?: string; invoice_number?: string };
};

type StripeEvent = { id: string; type: string; data: { object: StripeSession } };

async function markPaid(session: StripeSession) {
  const invoiceId = session.metadata?.invoice_id;
  if (!invoiceId) return;
  const invoice = await getInvoiceV2ById(invoiceId);
  if (!invoice || invoice.status !== "approved") return;
  const expectedCents = Math.round(invoiceTotals(invoice).total * 100);
  if (session.amount_total != null && session.amount_total !== expectedCents) throw new Error("Stripe amount does not match invoice total.");

  const method = session.payment_method_types?.includes("us_bank_account") ? "ach" : "card";
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("chillbros_invoices").update({
    payment_status: "paid",
    payment_method: method,
    paid_at: now,
    paid_recorded_by: null,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent ?? null,
    stripe_payment_status: "paid",
    updated_at: now,
  }).eq("id", invoiceId).neq("payment_status", "paid");
  if (error) throw error;

  const receipt = await createReceiptForPaidInvoice(invoiceId, null);
  await supabase.from("chillbros_receipts").update({
    payment_reference: session.payment_intent ?? session.id,
    payment_notes: "Paid securely through Stripe Checkout.",
  }).eq("id", receipt.id);
  await supabase.from("chillbros_workflow_events").insert({
    job_id: invoice.jobId,
    invoice_id: invoiceId,
    stage: "paid",
    message: `Online payment confirmed by Stripe via ${method === "ach" ? "ACH bank account" : "card / wallet"}.`,
  });
  try { await archiveInvoicePdf(invoiceId, "paid"); } catch { /* payment remains authoritative */ }
  for (const path of ["/invoices", "/payments", "/reports", "/", `/portal/${invoice.portalToken}`, `/portal/${invoice.portalToken}/receipt`]) revalidatePath(path);
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"))) return new NextResponse("Invalid signature", { status: 400 });
  const event = JSON.parse(raw) as StripeEvent;
  const session = event.data.object;

  try {
    if ((event.type === "checkout.session.completed" && session.payment_status === "paid") || event.type === "checkout.session.async_payment_succeeded") {
      await markPaid(session);
    } else if (event.type === "checkout.session.async_payment_failed" && session.metadata?.invoice_id) {
      const supabase = createServiceRoleClient();
      await supabase.from("chillbros_invoices").update({ stripe_payment_status: "failed", updated_at: new Date().toISOString() }).eq("id", session.metadata.invoice_id);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook reconciliation failed", event.id, error);
    return new NextResponse("Webhook processing failed", { status: 500 });
  }
}
