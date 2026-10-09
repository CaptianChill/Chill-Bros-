import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { sendOwnerPaymentReviewAlert } from "@/lib/chillbros/approval-notifications";
import { createReceiptForPaidInvoice } from "@/lib/chillbros/billing-receipts";
import { getInvoiceV2ById, getInvoiceV2ByToken, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

// Square Checkout API: a one-time Square payment page per invoice with the
// exact amount already filled in. Square hosts the card form (the card never
// touches this app) and offers Apple Pay / Google Pay / Cash App Pay where
// the customer's device supports them. A signed Square webhook marks the
// invoice (or down payment) paid automatically.
//
// Required env vars (all server-side):
//   SQUARE_ACCESS_TOKEN            production access token from the Square Developer app
//   SQUARE_LOCATION_ID             the business location that receives payments
//   SQUARE_WEBHOOK_SIGNATURE_KEY   from the webhook subscription (payment.updated)
// Optional:
//   SQUARE_ENVIRONMENT=sandbox     use Square's test environment
//   SQUARE_WEBHOOK_URL             exact notification URL registered in Square
// Until the first two are set the portal keeps the existing shared Square link.

const API_VERSION = "2025-01-23";

function config() {
  const accessToken = String(process.env.SQUARE_ACCESS_TOKEN || "").trim();
  const locationId = String(process.env.SQUARE_LOCATION_ID || "").trim();
  const sandbox = String(process.env.SQUARE_ENVIRONMENT || "").trim().toLowerCase() === "sandbox";
  return { accessToken, locationId, base: sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com" };
}

export function squareCheckoutConfigured() {
  const { accessToken, locationId } = config();
  return Boolean(accessToken && locationId);
}

async function squareFetch<T>(path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<T> {
  const { accessToken, base } = config();
  const response = await fetch(`${base}${path}`, {
    method: init.method,
    headers: { Authorization: `Bearer ${accessToken}`, "Square-Version": API_VERSION, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as T & { errors?: { detail?: string; code?: string }[] };
  if (!response.ok) throw new Error(payload.errors?.[0]?.detail || payload.errors?.[0]?.code || `Square request failed (${response.status}).`);
  return payload;
}

export type SquareCheckoutKind = "invoice" | "down_payment";

function downPaymentCents(invoice: { downPaymentAmount: number }, total: number) {
  return Math.round(Math.min(invoice.downPaymentAmount, total) * 100);
}

/** What the customer owes right now on this document, or an explanation. */
async function amountDue(token: string, kind: SquareCheckoutKind) {
  const invoice = await getInvoiceV2ByToken(token);
  if (!invoice) return { ok: false as const, error: "This payment link is no longer active." };
  if (invoice.convertedInvoiceId) return { ok: false as const, error: "This quote has been converted. Use the new invoice payment link." };
  if (invoice.status !== "approved") return { ok: false as const, error: "Approve the estimate before paying." };
  const totals = invoiceTotals(invoice);
  if (invoice.paymentStatus === "paid") return { ok: false as const, error: "This invoice is already paid. Thank you!" };
  if (kind === "down_payment") {
    // A down payment can be paid any time before the invoice is paid in full,
    // including after the owner adds one to an invoice that is already issued.
    if (invoice.downPaymentAmount <= 0 || invoice.downPaymentStatus === "paid") return { ok: false as const, error: "No down payment is due." };
    return { ok: true as const, invoice, cents: downPaymentCents(invoice, totals.total) };
  }
  if (!invoice.issuedAt) return { ok: false as const, error: "Payment opens once the work is complete and the invoice is issued." };
  return { ok: true as const, invoice, cents: Math.round(totals.amountDueNow * 100) };
}

export async function createSquareCheckout(token: string, kind: SquareCheckoutKind, portalUrl: string) {
  if (!squareCheckoutConfigured()) return { ok: false as const, error: "Online card payment isn't set up yet." };
  const due = await amountDue(token, kind);
  if (!due.ok) return due;
  if (due.cents < 100 || due.cents > 5_000_000) return { ok: false as const, error: "This amount can't be paid online. Please contact Chill Pros." };
  const { invoice, cents } = due;
  const { locationId } = config();
  const supabase = createServiceRoleClient();
  const { data: customer } = await supabase.from("chillbros_customers").select("email").eq("id", invoice.customerId).maybeSingle();
  const email = String(customer?.email ?? "").trim();

  const label = kind === "down_payment" ? `Down payment · ${invoice.invoiceNumber}` : `Chill Pros ${invoice.invoiceNumber}`;
  // Same invoice + kind + amount reuses the same Square checkout instead of
  // creating a new one on every tap.
  // Square caps the key at 45 characters, so hash the parts: a changed amount
  // (owner edited the invoice) must get a NEW checkout, never the old price.
  const idempotencyKey = `cp-${createHash("sha256").update(`${invoice.id}|${kind}|${cents}`).digest("hex").slice(0, 40)}`;
  const result = await squareFetch<{ payment_link?: { url?: string; order_id?: string } }>("/v2/online-checkout/payment-links", {
    method: "POST",
    body: {
      idempotency_key: idempotencyKey,
      order: {
        location_id: locationId,
        reference_id: invoice.id,
        metadata: { invoice_id: invoice.id, kind, invoice_number: invoice.invoiceNumber },
        line_items: [{ name: label, quantity: "1", base_price_money: { amount: cents, currency: "USD" } }],
      },
      checkout_options: { redirect_url: `${portalUrl}?payment=processing`, ask_for_shipping_address: false, allow_tipping: false, merchant_support_email: "chillprostx@gmail.com" },
      ...(email ? { pre_populated_data: { buyer_email: email } } : {}),
      payment_note: `${invoice.invoiceNumber} · ${invoice.customerName}`.slice(0, 500),
    },
  });
  const url = result.payment_link?.url;
  if (!url) return { ok: false as const, error: "Square didn't return a checkout page. Please try again." };
  await supabase.from("chillbros_workflow_events").insert({
    job_id: invoice.jobId,
    invoice_id: invoice.id,
    stage: "square_checkout_opened",
    message: `Customer opened Square checkout for ${kind === "down_payment" ? "the down payment" : "the invoice"} ($${(cents / 100).toFixed(2)}).`,
  });
  return { ok: true as const, url };
}

/** Square signs webhooks as base64 HMAC-SHA256(key, notificationUrl + body). */
export function verifySquareSignature(body: string, signature: string | null, notificationUrl: string) {
  const key = String(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "").trim();
  if (!key || !signature) return false;
  const expected = createHmac("sha256", key).update(notificationUrl + body).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

type SquarePayment = { id: string; status?: string; order_id?: string; amount_money?: { amount?: number; currency?: string }; receipt_url?: string };

/**
 * Called for a COMPLETED Square payment. Looks up the order to find our
 * invoice, checks the amount, and records the payment. Safe to call twice.
 */
export async function recordSquarePayment(payment: SquarePayment) {
  if (payment.status !== "COMPLETED" || !payment.order_id) return { recorded: false, reason: "not completed" };
  const { order } = await squareFetch<{ order?: { reference_id?: string; metadata?: Record<string, string> } }>(`/v2/orders/${encodeURIComponent(payment.order_id)}`, { method: "GET" });
  const invoiceId = order?.metadata?.invoice_id || order?.reference_id;
  const kind: SquareCheckoutKind = order?.metadata?.kind === "down_payment" ? "down_payment" : "invoice";
  if (!invoiceId) return { recorded: false, reason: "order is not a Chill Pros invoice" };
  const invoice = await getInvoiceV2ById(invoiceId);
  if (!invoice || invoice.status !== "approved") return { recorded: false, reason: "invoice not found or not approved" };

  const paidCents = Number(payment.amount_money?.amount ?? 0);
  const totals = invoiceTotals(invoice);
  const expectedCents = kind === "down_payment" ? downPaymentCents(invoice, totals.total) : Math.round(totals.amountDueNow * 100);
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  if (paidCents !== expectedCents) {
    // Don't guess — flag it for the office instead of marking it paid.
    const message = `Square payment ${payment.id} of $${(paidCents / 100).toFixed(2)} for ${kind === "down_payment" ? "the down payment" : "the invoice"} doesn't match the $${(expectedCents / 100).toFixed(2)} due now (the invoice may have been edited after the customer opened checkout). The money is in Square — review it, then record it in Payments.`;
    await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.jobId, invoice_id: invoiceId, stage: "square_payment_review", message });
    try { await sendOwnerPaymentReviewAlert({ invoiceNumber: invoice.invoiceNumber, customerName: invoice.customerName, message, invoiceId }); } catch (error) { console.error("[square] review alert failed", error); }
    return { recorded: false, reason: "amount mismatch" };
  }

  if (kind === "down_payment") {
    const { data } = await supabase.from("chillbros_invoices").update({ down_payment_status: "paid", down_payment_method: "card", down_payment_paid_at: now, updated_at: now }).eq("id", invoiceId).neq("down_payment_status", "paid").select("id").maybeSingle();
    if (!data) return { recorded: false, reason: "already recorded" };
    await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.jobId, invoice_id: invoiceId, stage: "down_payment_paid", message: `Down payment of $${(paidCents / 100).toFixed(2)} paid by card through Square (payment ${payment.id}).` });
    // A down payment that covers the whole issued invoice settles it.
    if (invoice.issuedAt && Math.round(totals.total * 100) <= paidCents) {
      const { data: settled } = await supabase.from("chillbros_invoices").update({ payment_status: "paid", payment_method: "card", paid_at: now, paid_recorded_by: null, updated_at: now }).eq("id", invoiceId).neq("payment_status", "paid").select("id").maybeSingle();
      if (settled) {
        const receipt = await createReceiptForPaidInvoice(invoiceId, null);
        await supabase.from("chillbros_receipts").update({ payment_reference: payment.id, payment_notes: "Paid in full by card through Square (down payment covered the total)." }).eq("id", receipt.id);
        await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.jobId, invoice_id: invoiceId, stage: "paid", message: "Down payment covered the full invoice — marked paid." });
        return { recorded: true, invoice, amount: paidCents / 100, kind: "invoice" as const };
      }
    }
    return { recorded: true, invoice, amount: paidCents / 100, kind };
  }

  const { data } = await supabase.from("chillbros_invoices").update({ payment_status: "paid", payment_method: "card", paid_at: now, paid_recorded_by: null, updated_at: now }).eq("id", invoiceId).neq("payment_status", "paid").select("id").maybeSingle();
  if (!data) return { recorded: false, reason: "already recorded" };
  const receipt = await createReceiptForPaidInvoice(invoiceId, null);
  await supabase.from("chillbros_receipts").update({ payment_reference: payment.id, payment_notes: "Paid securely by card through Square." }).eq("id", receipt.id);
  await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.jobId, invoice_id: invoiceId, stage: "paid", message: `Online card payment of $${(paidCents / 100).toFixed(2)} confirmed by Square (payment ${payment.id}).` });
  return { recorded: true, invoice, amount: paidCents / 100, kind };
}
