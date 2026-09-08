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
function esc(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char)); }

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
    await supabase.from("chillbros_delivery_log").insert({ invoice_id: invoiceId, channel, delivery_type: deliveryType, recipient, status: result.status, error: result.error?.slice(0, 1000) ?? null });
  } catch {}
}

function formatDue(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" });
}

export async function sendBillingDelivery(invoiceId: string, deliveryType: BillingDeliveryType, channel: BillingDeliveryChannel): Promise<DeliveryResult> {
  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase.from("chillbros_invoices").select("id,invoice_number,portal_token,status,payment_status,due_at,customer:chillbros_customers(name,email,phone)").eq("id", invoiceId).maybeSingle();
  if (!invoice) return { channel, recipient: null, status: "failed", error: "Invoice was not found." };

  const effectiveType: BillingDeliveryType = (invoice.invoice_number.startsWith("I-") || invoice.invoice_number.startsWith("INV-")) && deliveryType === "estimate" ? "invoice" : deliveryType;
  const customer = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
  const customerName = customer?.name ?? "Customer";
  const base = appBaseUrl();
  const portalUrl = `${base}/portal/${invoice.portal_token}`;
  const documentUrl = `${portalUrl}/document`;
  const receiptUrl = `${portalUrl}/receipt`;
  const due = formatDue(invoice.due_at);
  const label = effectiveType === "estimate" ? "estimate" : effectiveType === "receipt" ? "receipt" : "invoice";
  const subject = effectiveType === "reminder" ? `Reminder · Chill Bros invoice ${invoice.invoice_number}` : `Chill Bros ${label} ${invoice.invoice_number}`;
  const link = effectiveType === "receipt" ? receiptUrl : documentUrl;
  const intro = effectiveType === "estimate" ? "Your Chill Bros estimate is ready for review and approval."
    : effectiveType === "invoice" ? "Your Chill Bros invoice is ready to review and pay."
    : effectiveType === "reminder" ? `This is a reminder that Chill Bros invoice ${invoice.invoice_number}${due ? ` is due ${due}` : " is still outstanding"}.`
    : `Payment for ${invoice.invoice_number} has been recorded. Your receipt is ready.`;
  const text = [customerName + ",", "", intro, "", `Open document: ${link}`, due && effectiveType !== "receipt" ? `Due: ${due}` : null, "", "Chill Bros"].filter(Boolean).join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#05070a;font-family:Arial,sans-serif;color:#fff"><div style="max-width:640px;margin:0 auto;padding:28px"><div style="border:1px solid #2d7dff;border-radius:18px;padding:24px;background:#07111b"><div style="font-size:22px;font-weight:700;margin-bottom:16px">Chill Bros</div><p style="font-size:16px;line-height:1.6;color:#e5eef8">${esc(customerName)},</p><p style="font-size:16px;line-height:1.6;color:#e5eef8">${esc(intro)}</p>${due && effectiveType !== "receipt" ? `<p style="color:#b9c9d8">Due: ${esc(due)}</p>` : ""}<p style="margin:26px 0"><a href="${esc(link)}" style="display:inline-block;background:#1677ff;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">Open ${esc(label)}</a></p><p style="font-size:12px;color:#91a4b5;word-break:break-all">${esc(link)}</p></div></div></body></html>`;

  if (channel === "email") {
    const recipient = String(customer?.email || "").trim();
    if (!recipient) return { channel, recipient: null, status: "skipped", error: "Customer has no email address." };
    let result: DeliveryResult;
    try {
      const sent = await sendCompanyEmail(recipient, subject, text, html);
      result = { channel, recipient, status: sent.status };
    } catch (error) {
      result = { channel, recipient, status: "failed", error: error instanceof Error ? error.message : "Email delivery failed." };
    }
    await logDelivery(invoiceId, channel, effectiveType, recipient, result);
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
  await logDelivery(invoiceId, channel, effectiveType, recipient, result);
  return result;
}
