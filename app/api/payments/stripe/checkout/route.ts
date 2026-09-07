import { NextResponse } from "next/server";

import { getInvoiceV2ByToken, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { getPaymentSettings, stripeConfigured } from "@/lib/chillbros/payment-settings";
import { createStripeCheckoutSession } from "@/lib/chillbros/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "").trim();
  if (!token) return NextResponse.redirect(new URL("/", request.url));

  const [settings, invoice] = await Promise.all([getPaymentSettings(), getInvoiceV2ByToken(token)]);
  if (!invoice) return NextResponse.redirect(new URL("/", request.url));
  const portalUrl = new URL(`/portal/${invoice.portalToken}`, request.url);
  if (!settings.stripeEnabled || !stripeConfigured()) {
    portalUrl.searchParams.set("payment_error", "Online payment is not configured yet.");
    return NextResponse.redirect(portalUrl);
  }
  if (invoice.status !== "approved" || invoice.paymentStatus === "paid") {
    portalUrl.searchParams.set("payment_error", invoice.paymentStatus === "paid" ? "This invoice is already paid." : "Approve the invoice before paying online.");
    return NextResponse.redirect(portalUrl);
  }

  const totals = invoiceTotals(invoice);
  const amountCents = Math.round(totals.total * 100);
  if (!Number.isInteger(amountCents) || amountCents < 50 || amountCents > 25000000) {
    portalUrl.searchParams.set("payment_error", "This invoice total cannot be sent to online checkout.");
    return NextResponse.redirect(portalUrl);
  }

  const supabase = createServiceRoleClient();
  const { data: customer } = await supabase.from("chillbros_customers").select("email").eq("id", invoice.customerId).maybeSingle();
  try {
    const session = await createStripeCheckoutSession({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      portalToken: invoice.portalToken,
      amountCents,
      customerEmail: customer?.email ?? null,
      successUrl: `${portalUrl.origin}/portal/${invoice.portalToken}?payment=processing`,
      cancelUrl: `${portalUrl.origin}/portal/${invoice.portalToken}?payment=cancelled`,
    });
    await supabase.from("chillbros_invoices").update({
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent ?? null,
      stripe_payment_status: "checkout_created",
      updated_at: new Date().toISOString(),
    }).eq("id", invoice.id);
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    portalUrl.searchParams.set("payment_error", error instanceof Error ? error.message : "Online checkout could not be created.");
    return NextResponse.redirect(portalUrl, 303);
  }
}
