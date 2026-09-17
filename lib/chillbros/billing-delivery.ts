import "server-only";

import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export type BillingDeliveryType = "estimate" | "invoice" | "reminder" | "receipt";
export type BillingDeliveryChannel = "email" | "sms";

export type DeliveryResult = { channel: BillingDeliveryChannel; recipient: string | null; status: "sent" | "failed" | "configuration_required" | "skipped"; error?: string };

async function logBillingEmail(invoiceId: string, subject: string, recipient: string, result: DeliveryResult) {
  try {
    const { error } = await createServiceRoleClient().from("chillbros_email_log").insert({
      related_invoice_id: invoiceId, subject, recipients: recipient || "(missing recipient)", status: result.status === "sent" ? "sent" : "failed",
    });
    if (error) console.error("[billing-email] log insert failed", error);
  } catch (error) { console.error("[billing-email] log insert failed", error); }
}

/** Delivery failures must not undo saved work, but remain visible in its audit trail. */
export async function sendBillingDeliveryRecorded(invoiceId: string, type: BillingDeliveryType, channel: BillingDeliveryChannel): Promise<DeliveryResult> {
  let result: DeliveryResult;
  try { result = await sendBillingDelivery(invoiceId, type, channel); }
  catch (error) { result = { channel, recipient: null, status: "failed", error: error instanceof Error ? error.message : "Delivery failed." }; }
  try {
    const supabase = createServiceRoleClient();
    const { data: invoice, error: readError } = await supabase.from("chillbros_invoices").select("job_id").eq("id", invoiceId).maybeSingle();
    if (readError) console.error("[billing-delivery] invoice lookup failed", readError);
    const { error } = await supabase.from("chillbros_workflow_events").insert({
      job_id: invoice?.job_id ?? null, invoice_id: invoiceId, stage: `invoice_${channel}_${result.status}`,
      message: `${type} ${channel} ${result.status}${result.recipient ? ` to ${result.recipient}` : ""}${result.error ? `: ${result.error}` : ""}`.slice(0, 1000),
    });
    if (error) console.error("[billing-delivery] workflow log failed", error);
  } catch (error) { console.error("[billing-delivery] workflow log failed", error); }
  return result;
}

function appBaseUrl() {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
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
    const { error } = await supabase.from("chillbros_delivery_log").insert({ invoice_id: invoiceId, channel, delivery_type: deliveryType, recipient: recipient || "(missing recipient)", status: result.status, error: result.error?.slice(0, 1000) ?? null });
    if (error) console.error("[billing-delivery] log insert failed", error);
  } catch (error) { console.error("[billing-delivery] log insert failed", error); }
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
    if (!recipient) {
      const result: DeliveryResult = { channel, recipient: null, status: "skipped", error: "Customer has no email address." };
      await logDelivery(invoiceId, channel, effectiveType, "", result);
      await logBillingEmail(invoiceId, subject, "", result);
      return result;
    }
    let result: DeliveryResult;
    try {
      const sent = await sendCompanyEmail(recipient, subject, text, html);
      result = { channel, recipient, status: sent.status, error: "error" in sent ? sent.error : undefined };
    } catch (error) {
      result = { channel, recipient, status: "failed", error: error instanceof Error ? error.message : "Email delivery failed." };
    }
    await logDelivery(invoiceId, channel, effectiveType, recipient, result);
    await logBillingEmail(invoiceId, subject, recipient, result);
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
