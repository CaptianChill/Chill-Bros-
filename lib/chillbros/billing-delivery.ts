import "server-only";

import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export type BillingDeliveryType = "estimate" | "invoice" | "reminder" | "receipt";
export type BillingDeliveryChannel = "email" | "sms";

type DeliveryResult = { channel: BillingDeliveryChannel; recipient: string | null; status: "sent" | "failed" | "configuration_required" | "skipped"; error?: string };

function appBaseUrl() {
  const explicit = String(process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim().replace(/\/$/, "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  return "https://chill-bros.vercel.app";
}

function normalizePhone(input: string) {
  const raw = String(input || "").trim();
  if (raw.startsWith("+") && /^\+\d{8,15}$/.test(raw.replace(/[\s().-]/g, ""))) return raw.replace(/[\s().-]/g, "");
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

async function sendTwilioSms(to: string, body: string) {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  const from = String(process.env.TWILIO_FROM_NUMBER || "").trim();
  if (!accountSid || !authToken || !from) return { sent: false as const, status: "configuration_required" as const };
  const normalized = normalizePhone(to);
  if (!normalized) return { sent: false as const, status: "failed" as const, error: "Customer phone number is not valid for SMS delivery." };

  const form = new URLSearchParams({ To: normalized, From: from, Body: body });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });
  if (!response.ok) return { sent: false as const, status: "failed" as const, error: `Twilio returned HTTP ${response.status}.` };
  return { sent: true as const, status: "sent" as const };
}

async function logDelivery(invoiceId: string, channel: BillingDeliveryChannel, deliveryType: BillingDeliveryType, recipient: string, result: DeliveryResult) {
  try {
    const supabase = createServiceRoleClient();
    await supabase.from("chillbros_delivery_log").insert({
      invoice_id: invoiceId,
      channel,
      delivery_type: deliveryType,
      recipient,
      status: result.status,
      error: result.error?.slice(0, 1000) ?? null,
    });
  } catch {
    // Delivery remains authoritative even if logging is temporarily unavailable.
  }
}

function formatDue(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" });
}

export async function sendBillingDelivery(invoiceId: string, deliveryType: BillingDeliveryType, channel: BillingDeliveryChannel): Promise<DeliveryResult> {
  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase.from("chillbros_invoices").select("id,invoice_number,portal_token,status,payment_status,due_at,customer:chillbros_customers(name,email,phone)").eq("id", invoiceId).maybeSingle();
  if (!invoice) return { channel, recipient: null, status: "failed", error: "Invoice was not found." };
  const customer = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
  const customerName = customer?.name ?? "Customer";
  const base = appBaseUrl();
  const documentUrl = `${base}/portal/${invoice.portal_token}`;
  const receiptUrl = `${documentUrl}/receipt`;
  const due = formatDue(invoice.due_at);
  const label = deliveryType === "estimate" ? "estimate" : deliveryType === "receipt" ? "receipt" : "invoice";
  const subject = deliveryType === "reminder" ? `Reminder · Chill Bros invoice ${invoice.invoice_number}` : `Chill Bros ${label} ${invoice.invoice_number}`;
  const link = deliveryType === "receipt" ? receiptUrl : documentUrl;
  const text = [
    `${customerName},`,
    "",
    deliveryType === "estimate" ? "Your Chill Bros estimate is ready for review and approval." : null,
    deliveryType === "invoice" ? "Your approved Chill Bros invoice is ready." : null,
    deliveryType === "reminder" ? `This is a reminder that Chill Bros invoice ${invoice.invoice_number}${due ? ` is due ${due}` : " is still outstanding"}.` : null,
    deliveryType === "receipt" ? `Payment for ${invoice.invoice_number} has been recorded. Your receipt is ready.` : null,
    "",
    `Secure link: ${link}`,
    due && deliveryType !== "receipt" ? `Due: ${due}` : null,
    "",
    "Chill Bros",
  ].filter(Boolean).join("\n");

  if (channel === "email") {
    const recipient = String(customer?.email || "").trim();
    if (!recipient) return { channel, recipient: null, status: "skipped", error: "Customer has no email address." };
    let result: DeliveryResult;
    try {
      const sent = await sendCompanyEmail(recipient, subject, text);
      result = { channel, recipient, status: sent.status };
    } catch (error) {
      result = { channel, recipient, status: "failed", error: error instanceof Error ? error.message : "Email delivery failed." };
    }
    await logDelivery(invoiceId, channel, deliveryType, recipient, result);
    return result;
  }

  const recipient = String(customer?.phone || "").trim();
  if (!recipient) return { channel, recipient: null, status: "skipped", error: "Customer has no phone number." };
  let result: DeliveryResult;
  try {
    const sent = await sendTwilioSms(recipient, `${subject}\n${link}`);
    result = { channel, recipient, status: sent.status, error: "error" in sent ? sent.error : undefined };
  } catch (error) {
    result = { channel, recipient, status: "failed", error: error instanceof Error ? error.message : "SMS delivery failed." };
  }
  await logDelivery(invoiceId, channel, deliveryType, recipient, result);
  return result;
}
