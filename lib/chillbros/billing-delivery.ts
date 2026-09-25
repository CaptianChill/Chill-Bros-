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
export async function sendBillingDeliveryRecorded(invoiceId: string, type: BillingDeliveryType, channel: BillingDeliveryChannel, overrideRecipient?: string): Promise<DeliveryResult> {
  let result: DeliveryResult;
  try { result = await sendBillingDelivery(invoiceId, type, channel, overrideRecipient); }
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
  return "https://chill-bros-chill-pros.vercel.app";
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

export async function sendBillingDelivery(invoiceId: string, deliveryType: BillingDeliveryType, channel: BillingDeliveryChannel, overrideRecipient?: string): Promise<DeliveryResult> {
  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase.from("chillbros_invoices").select("id,invoice_number,portal_token,status,payment_status,due_at,customer:chillbros_customers(name,email,phone),job:chillbros_jobs(location)").eq("id", invoiceId).maybeSingle();
  if (!invoice) return { channel, recipient: null, status: "failed", error: "Invoice was not found." };

  const effectiveType: BillingDeliveryType = (invoice.invoice_number.startsWith("I-") || invoice.invoice_number.startsWith("INV-")) && deliveryType === "estimate" ? "invoice" : deliveryType;
  const customer = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
  const job = Array.isArray(invoice.job) ? invoice.job[0] : invoice.job;
  const customerName = customer?.name ?? "Customer";
  const location = String(job?.location ?? "").trim();
  const base = appBaseUrl();
  const portalUrl = `${base}/portal/${invoice.portal_token}`;
  const receiptUrl = `${portalUrl}/receipt`;
  const due = formatDue(invoice.due_at);
  // Plain, professional wording. Corporate mail filters tend to hold
  // messages that read like payment demands ("invoice ... pay now") from an
  // unfamiliar sender, so the subject names the service and the customer.
  const where = location ? ` at ${location}` : "";
  const subject = effectiveType === "estimate" ? `Chill Pros estimate ${invoice.invoice_number} for ${customerName}`
    : effectiveType === "reminder" ? `Friendly reminder: Chill Pros ${invoice.invoice_number}`
    : effectiveType === "receipt" ? `Thank you – receipt for ${invoice.invoice_number}`
    : `Service completed – ${customerName} (${invoice.invoice_number})`;
  const link = effectiveType === "receipt" ? receiptUrl : portalUrl;
  const intro = effectiveType === "estimate" ? `Thank you for the opportunity to help${where}. Your estimate is ready to review. You can approve it online with one click.`
    : effectiveType === "invoice" ? `Thank you for choosing Chill Pros. Our service visit${where} is complete, and the invoice for this visit is ready to view along with the work performed and photos.`
    : effectiveType === "reminder" ? `A friendly reminder that ${invoice.invoice_number}${due ? ` was due ${due}` : " is still open"}. If you've already taken care of it, thank you, and please disregard this note.`
    : `Thank you. We've recorded your payment for ${invoice.invoice_number}. Your receipt is ready.`;
  const button = effectiveType === "estimate" ? "Review estimate" : effectiveType === "receipt" ? "View receipt" : "View invoice";
  const signoff = ["Chill Pros", "Chill Professionals LLC · San Antonio, Texas", "Questions? Just reply to this email."];
  const text = [`Hello ${customerName},`, "", intro, "", `${button}: ${link}`, due && effectiveType === "invoice" ? `Due: ${due}` : null, "", ...signoff].filter((line) => line !== null).join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#0a1a33"><div style="max-width:600px;margin:0 auto;padding:24px 16px"><div style="background:#0a1a33;border-radius:14px 14px 0 0;padding:18px 24px"><img src="${esc(base)}/brand/chill-pros-badge-180.png" alt="Chill Pros" width="56" height="56" style="display:block;border:0"></div><div style="background:#ffffff;border:1px solid #d5deea;border-top:0;border-radius:0 0 14px 14px;padding:24px"><p style="font-size:16px;line-height:1.6;margin:0 0 12px">Hello ${esc(customerName)},</p><p style="font-size:16px;line-height:1.6;margin:0 0 16px">${esc(intro)}</p>${due && effectiveType === "invoice" ? `<p style="font-size:14px;color:#4a5b74;margin:0 0 16px">Due: ${esc(due)}</p>` : ""}<p style="margin:22px 0"><a href="${esc(link)}" style="display:inline-block;background:#1557b0;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">${esc(button)}</a></p><p style="font-size:12px;color:#4a5b74;word-break:break-all;margin:0 0 20px">${esc(link)}</p><p style="font-size:14px;line-height:1.6;color:#3d5170;margin:0">Chill Pros<br>Chill Professionals LLC · San Antonio, Texas<br>Questions? Just reply to this email.</p></div></div></body></html>`;

  if (channel === "email") {
    const override = String(overrideRecipient || "").trim().toLowerCase();
    if (override && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(override)) return { channel, recipient: null, status: "failed", error: "That override email address is not valid." };
    const recipient = override || String(customer?.email || "").trim();
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

  const overridePhone = String(overrideRecipient || "").trim();
  if (overridePhone && !normalizePhone(overridePhone)) return { channel, recipient: null, status: "failed", error: "That override phone number is not valid for SMS delivery." };
  const recipient = overridePhone || String(customer?.phone || "").trim();
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
