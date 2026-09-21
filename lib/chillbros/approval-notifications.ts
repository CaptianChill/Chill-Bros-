import "server-only";
import * as tls from "node:tls";

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

export async function sendCompanyEmail(to: string, subject: string, text: string, html?: string) {
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
    await command(socket, "DATA", ["354"]);

    const headers = [
      `From: Chill Pros <${safeHeader(user)}>`,
      `To: ${safeHeader(to)}`,
      `Subject: ${safeHeader(subject)}`,
      "MIME-Version: 1.0",
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

async function sendOwnerAlertEmail(subject: string, lines: (string | null)[], relatedInvoiceId?: string | null) {
  const to = companyEmail();
  const text = lines.filter(Boolean).join("\n");

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
  ], input.relatedInvoiceId);
}

export async function sendInvoiceViewedNotification(input: { invoiceNumber: string; customerName?: string | null; invoiceId: string }) {
  return sendOwnerAlertEmail(safeHeader(`Invoice ${input.invoiceNumber} opened by customer`), [
    "Chill Pros invoice opened by the customer.",
    "",
    `Invoice: ${input.invoiceNumber}`,
    input.customerName ? `Customer: ${input.customerName}` : null,
    `Opened: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })} CT`,
  ], input.invoiceId);
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
  ], input.invoiceId);
}
