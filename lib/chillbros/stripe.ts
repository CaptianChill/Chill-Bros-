import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return key;
}

export async function createStripeCheckoutSession(input: {
  invoiceId: string;
  invoiceNumber: string;
  portalToken: string;
  amountCents: number;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string; payment_intent: string | null }> {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.append("payment_method_types[]", "card");
  body.append("payment_method_types[]", "us_bank_account");
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][product_data][name]", `Chill Bros Invoice ${input.invoiceNumber}`);
  body.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[invoice_id]", input.invoiceId);
  body.set("metadata[portal_token]", input.portalToken);
  body.set("metadata[invoice_number]", input.invoiceNumber);
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  if (input.customerEmail) body.set("customer_email", input.customerEmail);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const payload = await response.json() as { id?: string; url?: string; payment_intent?: string | null; error?: { message?: string } };
  if (!response.ok || !payload.id || !payload.url) throw new Error(payload.error?.message ?? "Stripe checkout session could not be created.");
  return { id: payload.id, url: payload.url, payment_intent: payload.payment_intent ?? null };
}

export function verifyStripeSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const parts = signatureHeader.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return signatures.some((signature) => {
    try {
      const a = Buffer.from(signature, "hex");
      const b = Buffer.from(expected, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch { return false; }
  });
}
