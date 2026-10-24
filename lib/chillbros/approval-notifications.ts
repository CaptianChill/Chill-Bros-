import "server-only";
import * as tls from "node:tls";

import { notifyOwner } from "@/lib/chillbros/notify";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

type ApprovalNotification = {
  subject: string;
  documentLabel: string;
  documentNumber: string;
  signedBy: string;
  customerName?: string | null;
  relatedInvoiceId?: string | null;
};

function safeHeader(value: string) { return String(value).replace(/[\r\n]+/g, " ").trim(); }
function companyEmail() { return String(process.env.COMPANY_MAIN_EMAIL || "chillprostx@gmail.com").trim(); }
function dotStuff(value: string) { return value.replace(/^\./gm, ".."); }

function readResponse(socket: tls.TLSSocket) {
  return new Promise<string>((resolve, reject) => {
    let buffer = "";
    const cleanup = () => { socket.off("data", onData); socket.off("error", onError); socket.off("timeout", onTimeout); };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onTimeout = () => { cleanup(); reject(new Error("SMTP connection timed out.")); };
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n").filter(Boolean);
      const last = lines.at(-1) ?? "";
      if (/^\d{3} /.test(last)) { cleanup(); resolve(buffer); }
    };
    socket.on("data", onData); socket.once("error", onError); socket.once("timeout", onTimeout);
  });
}

async function command(socket: tls.TLSSocket, text: string, expected: string[]) {
  socket.write(`${text}\r\n`);
  const response = await readResponse(socket);
  const code = response.slice(0, 3);
  if (!expected.includes(code)) throw new Error(`SMTP rejected command (${code || "unknown"}).`);
  return response;
}

export async function sendCompanyEmail(to: string, subject: string, text: string, html?: string, cc: string[] = [], extraHeaders: Record<string, string> = {}) {
  // CC addresses get the same message; the main recipient is never repeated in CC.
  const ccList = [...new Set(cc.map((address) => safeHeader(address).toLowerCase()).filter((address) => address && address !== safeHeader(to).toLowerCase()))];
  const user = String(process.env.GMAIL_SMTP_USER || "").trim();
  const password = String(process.env.GMAIL_SMTP_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!user || !password) return { sent: false as const, status: "configuration_required" as const, error: "Missing environment variable(s): " + [!user && "GMAIL_SMTP_USER", !password && "GMAIL_SMTP_APP_PASSWORD"].filter(Boolean).join(", ") };

  const socket = tls.connect({ host: "smtp.gmail.com", port: 465, servername: "smtp.gmail.com", timeout: 12000 });
  try {
    await new Promise<void>((resolve, reject) => { socket.once("secureConnect", resolve); socket.once("error", reject); });
    const greeting = await readResponse(socket);
    if (!greeting.startsWith("220")) throw new Error("SMTP greeting failed.");
    await command(socket, "EHLO chillbros.vercel.app", ["250"]);
    await command(socket, "AUTH LOGIN", ["334"]);
    await command(socket, Buffer.from(user).toString("base64"), ["334"]);
    await command(socket, Buffer.from(password).toString("base64"), ["235"]);
    await command(socket, `MAIL FROM:<${safeHeader(user)}>`, ["250"]);
    await command(socket, `RCPT TO:<${safeHeader(to)}>`, ["250", "251"]);
    for (const address of ccList) await command(socket, `RCPT TO:<${address}>`, ["250", "251"]);
    await command(socket, "DATA", ["354"]);

    const headers = [
      `From: Chill Pros <${safeHeader(user)}>`,
      `To: ${safeHeader(to)}`,
      ...(ccList.length ? [`Cc: ${ccList.join(", ")}`] : []),
      `Subject: ${safeHeader(subject)}`,
      "MIME-Version: 1.0",
      // Optional extra headers (e.g. List-Unsubscribe on outreach email); names are restricted to header-safe characters.
      ...Object.entries(extraHeaders).filter(([name]) => /^[A-Za-z][A-Za-z0-9-]*$/.test(name)).map(([name, value]) => `${name}: ${safeHeader(value)}`),
    ];
    let body: string;
    if (html) {
      const boundary = `chillbros_${Date.now().toString(36)}`;
      body = [
        ...headers,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        dotStuff(text),
        `--${boundary}`,
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        dotStuff(html),
        `--${boundary}--`,
        ".",
        "",
      ].join("\r\n");
    } else {
      body = [
        ...headers,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        dotStuff(text),
        ".",
        "",
      ].join("\r\n");
    }
    socket.write(body);
    const accepted = await readResponse(socket);
    if (!accepted.startsWith("250")) throw new Error("SMTP message was not accepted.");
    await command(socket, "QUIT", ["221"]);
    return { sent: true as const, status: "sent" as const };
  } finally {
    socket.destroy();
  }
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type OwnerPush = { title: string; message: string; level: "urgent" | "important" | "good" | "info" | "low" };

async function sendOwnerAlertEmail(subject: string, lines: (string | null)[], relatedInvoiceId?: string | null, push?: OwnerPush) {
  const to = companyEmail();
  const text = lines.filter(Boolean).join("\n");
  // Every owner alert also lands on the owner's phone (ntfy); skip the email's first headline line.
  if (push) await notifyOwner({ title: push.title, message: push.message, level: push.level, path: relatedInvoiceId ? `/owner/invoices/${relatedInvoiceId}` : null });

  let status = "failed";
  try {
    const result = await sendCompanyEmail(to, subject, text);
    status = result.sent ? result.status : result.error;
  } catch (error) {
    status = `failed: ${error instanceof Error ? error.message.slice(0, 160) : "unknown SMTP error"}`;
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("chillbros_email_log").insert({ subject, recipients: to, related_invoice_id: relatedInvoiceId ?? null, status: status === "sent" ? "sent" : "failed" });
    if (error) console.error("[owner-alert-email] log insert failed", error);
  } catch (error) { console.error("[owner-alert-email] log insert failed", error); }
  return { sent: status === "sent", status, recipient: to };
}

export async function sendApprovalNotification(input: ApprovalNotification) {
  return sendOwnerAlertEmail(safeHeader(input.subject), [
    "Chill Pros customer approval received.",
    "",
    `${input.documentLabel}: ${input.documentNumber}`,
    input.customerName ? `Customer: ${input.customerName}` : null,
    `Signed by: ${input.signedBy}`,
    `Approved: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })} CT`,
    "",
    "The manager and dispatch views have already been updated in the Operations Center.",
  ], input.relatedInvoiceId, { title: `Approved · ${input.documentNumber}`, message: `${input.customerName ?? "Customer"} · signed by ${input.signedBy}`, level: "good" });
}

export async function sendInvoiceViewedNotification(input: { invoiceNumber: string; customerName?: string | null; invoiceId: string }) {
  return sendOwnerAlertEmail(safeHeader(`Invoice ${input.invoiceNumber} opened by customer`), [
    "Chill Pros invoice opened by the customer.",
    "",
    `Invoice: ${input.invoiceNumber}`,
    input.customerName ? `Customer: ${input.customerName}` : null,
    `Opened: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })} CT`,
  ], input.invoiceId, { title: `Invoice opened · ${input.invoiceNumber}`, message: input.customerName ?? "Customer", level: "low" });
}

export async function sendInvoicePaidNotification(input: { invoiceNumber: string; customerName?: string | null; amount: number; method: string; invoiceId: string }) {
  return sendOwnerAlertEmail(safeHeader(`Payment received — Invoice ${input.invoiceNumber}`), [
    "Chill Pros payment received.",
    "",
    `Invoice: ${input.invoiceNumber}`,
    input.customerName ? `Customer: ${input.customerName}` : null,
    `Amount: ${input.amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
    `Method: ${input.method.replace(/_/g, " ")}`,
    `Paid: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })} CT`,
  ], input.invoiceId, { title: `Paid ${usd(input.amount)} · ${input.invoiceNumber}`, message: input.customerName ?? "Customer", level: "good" });
}

export async function sendOwnerPaymentReviewAlert(input: { invoiceNumber: string; customerName?: string | null; message: string; invoiceId: string }) {
  return sendOwnerAlertEmail(safeHeader(`Check this payment — ${input.invoiceNumber}`), [
    "A customer paid through Square, but the amount didn't match what's due, so the app did NOT mark it paid.",
    "",
    `Document: ${input.invoiceNumber}`,
    input.customerName ? `Customer: ${input.customerName}` : null,
    input.message,
  ], input.invoiceId, { title: `Check payment · ${input.invoiceNumber}`, message: `${input.customerName ?? "Customer"} · amount didn't match, not marked paid`, level: "urgent" });
}

export async function sendDownPaymentReceivedNotification(input: { invoiceNumber: string; customerName?: string | null; amount: number; method: string; invoiceId: string }) {
  return sendOwnerAlertEmail(safeHeader(`Down payment received — ${input.invoiceNumber}`), [
    "Chill Pros down payment received.",
    "",
    `Document: ${input.invoiceNumber}`,
    input.customerName ? `Customer: ${input.customerName}` : null,
    `Amount: ${input.amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
    `Method: ${input.method.replace(/_/g, " ")}`,
    `Received: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })} CT`,
  ], input.invoiceId, { title: `Down payment ${usd(input.amount)} · ${input.invoiceNumber}`, message: input.customerName ?? "Customer", level: "good" });
}
