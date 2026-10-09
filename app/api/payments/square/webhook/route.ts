import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { sendDownPaymentReceivedNotification, sendInvoicePaidNotification } from "@/lib/chillbros/approval-notifications";
import { sendBillingDeliveryRecorded } from "@/lib/chillbros/billing-delivery";
import { archiveInvoicePdf } from "@/lib/chillbros/invoice-pdf";
import { recordSquarePayment, verifySquareSignature } from "@/lib/chillbros/square-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SquareEvent = { event_id?: string; type?: string; data?: { object?: { payment?: { id: string; status?: string; order_id?: string; amount_money?: { amount?: number } } } } };

// Square "payment.updated" / "payment.created" webhook. Marks the matching
// invoice or down payment paid once Square reports the payment COMPLETED.
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature");
  const configuredUrl = String(process.env.SQUARE_WEBHOOK_URL || "").trim();
  const canonicalUrl = "https://chill-bros.vercel.app/api/payments/square/webhook";
  const candidates = Array.from(new Set([configuredUrl, request.url, canonicalUrl].filter(Boolean)));
  if (!candidates.some((url) => verifySquareSignature(raw, signature, url))) {
    console.error("[square-webhook] invalid signature", { configured: Boolean(configuredUrl), requestUrl: request.url });
    return new NextResponse("Invalid signature", { status: 401 });
  }
  const event = JSON.parse(raw) as SquareEvent;
  const payment = event.data?.object?.payment;
  if (!payment || !["payment.updated", "payment.created"].includes(event.type ?? "")) return NextResponse.json({ received: true });

  try {
    const result = await recordSquarePayment(payment);
    if (result.recorded && result.invoice) {
      const { invoice } = result;
      if (result.kind === "invoice") {
        try {
          let delivery = await sendBillingDeliveryRecorded(invoice.id, "receipt", "email");
          if (delivery.status === "skipped" && delivery.error === "Customer has no email address.") {
            delivery = await sendBillingDeliveryRecorded(invoice.id, "receipt", "sms");
          }
          if (delivery.status !== "sent") console.error("[square-webhook] receipt delivery incomplete", delivery);
        } catch (error) { console.error("[square-webhook] receipt delivery failed", error); }
        try { await archiveInvoicePdf(invoice.id, "paid"); } catch { /* payment stays recorded */ }
      }
      try {
        const alert = { invoiceNumber: invoice.invoiceNumber, customerName: invoice.customerName, amount: result.amount ?? 0, method: "card (Square)", invoiceId: invoice.id };
        if (result.kind === "down_payment") await sendDownPaymentReceivedNotification(alert); else await sendInvoicePaidNotification(alert);
      } catch (error) { console.error("[square-webhook] owner notification failed", error); }
      for (const path of ["/invoices", "/payments", "/reports", "/", `/portal/${invoice.portalToken}`, `/portal/${invoice.portalToken}/receipt`]) revalidatePath(path);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[square-webhook] reconciliation failed", event.event_id, error);
    // 500 so Square retries later.
    return new NextResponse("Reconciliation failed", { status: 500 });
  }
}
