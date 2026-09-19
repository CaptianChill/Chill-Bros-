import "server-only";

import { createHash } from "node:crypto";

import { getInvoiceV2ById, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";
import { PAYMENT_METHOD_LABELS, PAYMENT_TERMS_LABELS } from "@/lib/chillbros/types";

export type ArchiveStage = "approved" | "paid";

function ascii(value: string) { return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, ""); }
function pdfEscape(value: string) { return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function money(value: number) { return `$${value.toFixed(2)}`; }
function date(value: string | null) { return value ? new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }) + " CT" : "-"; }

function wrapLine(value: string, max = 88) {
  const words = ascii(value).split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= max) line += ` ${word}`;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

function buildPdf(lines: string[]) {
  const perPage = 48;
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / perPage)) }, (_, index) => lines.slice(index * perPage, (index + 1) * perPage));
  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];
  const fontObject = 3;
  let nextObject = 4;
  for (let i = 0; i < pages.length; i += 1) { pageObjectNumbers.push(nextObject); nextObject += 2; }
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(" ")}] >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pages.forEach((pageLines, index) => {
    const pageObject = pageObjectNumbers[index];
    const streamObject = pageObject + 1;
    const commands = pageLines.map((line, lineIndex) => `BT /F1 10 Tf 48 ${744 - lineIndex * 14} Td (${pdfEscape(line)}) Tj ET`).join("\n");
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${streamObject} 0 R >>`;
    objects[streamObject] = `<< /Length ${Buffer.byteLength(commands, "utf8")} >>\nstream\n${commands}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = Buffer.byteLength(pdf, "utf8");
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

async function invoicePdf(invoiceId: string, stage: ArchiveStage) {
  const invoice = await getInvoiceV2ById(invoiceId);
  if (!invoice) throw new Error("Invoice not found for PDF archive.");
  const totals = invoiceTotals(invoice);
  const lines: string[] = [
    "CHILL BROS",
    stage === "paid" ? "FINAL PAID INVOICE / RECEIPT ARCHIVE" : "APPROVED INVOICE ARCHIVE",
    "",
    `Document: ${invoice.invoiceNumber}`,
    `Customer: ${invoice.customerName}`,
    `Status: ${stage === "paid" ? "PAID" : "APPROVED"}`,
    `Issued: ${date(invoice.issuedAt ?? invoice.signedAt)}`,
    `Due: ${date(invoice.dueAt)}`,
    `Terms: ${PAYMENT_TERMS_LABELS[invoice.paymentTerms]}`,
    `Approved by: ${invoice.signatureName ?? "-"}`,
    `Approved: ${date(invoice.signedAt)}`,
    "",
    "ITEMS",
  ];
  for (const item of invoice.lineItems) {
    lines.push(`${item.label} | Qty ${item.quantity} x ${money(item.unitPrice)} | ${money(item.amount)}${item.taxable ? " | taxable" : ""}`);
    if (item.description) lines.push(...wrapLine(`  ${item.description}`, 82));
  }
  lines.push(
    "",
    `Subtotal: ${money(totals.subtotal)}`,
    invoice.discountAmount > 0 ? `Discount: -${money(invoice.discountAmount)}` : "Discount: $0.00",
    `Tax (${invoice.taxRate.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%): ${money(invoice.taxAmount)}`,
    invoice.creditAmount > 0 ? `Credits applied: -${money(invoice.creditAmount)}` : "Credits applied: $0.00",
    `Invoice total: ${money(totals.total)}`,
    invoice.downPaymentAmount > 0 ? `Required down payment: ${money(Math.min(invoice.downPaymentAmount, totals.total))}` : "Required down payment: $0.00",
    invoice.refundAmount > 0 ? `Refunds recorded after invoice: ${money(invoice.refundAmount)}` : "Refunds recorded: $0.00",
    `Payment method: ${invoice.paymentMethod ? PAYMENT_METHOD_LABELS[invoice.paymentMethod] : "Not selected"}`,
    `Payment status: ${invoice.paymentStatus.replace(/_/g, " ")}`,
  );
  if (invoice.notes) { lines.push("", "NOTES", ...wrapLine(invoice.notes)); }
  lines.push("", "This PDF is an immutable Chill Bros billing snapshot generated by the Operations Center.");
  return buildPdf(lines);
}

export async function archiveInvoicePdf(invoiceId: string, stage: ArchiveStage, actorId: string | null = null) {
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase.from("chillbros_document_archives").select("id,sha256,created_at").eq("invoice_id", invoiceId).eq("stage", stage).maybeSingle();
  if (existing) return existing;
  const pdf = await invoicePdf(invoiceId, stage);
  const sha256 = createHash("sha256").update(pdf).digest("hex");
  const { data, error } = await supabase.from("chillbros_document_archives").insert({ invoice_id: invoiceId, stage, pdf_base64: pdf.toString("base64"), sha256, created_by: actorId }).select("id,sha256,created_at").single();
  if (error) {
    const { data: raced } = await supabase.from("chillbros_document_archives").select("id,sha256,created_at").eq("invoice_id", invoiceId).eq("stage", stage).maybeSingle();
    if (raced) return raced;
    throw error;
  }
  return data;
}

export async function getArchivedPdfByToken(token: string, requestedStage?: ArchiveStage | null) {
  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase.from("chillbros_invoices").select("id,invoice_number,status,payment_status").eq("portal_token", token).is("revoked_at", null).neq("status", "void").maybeSingle();
  if (!invoice) return null;
  const stage: ArchiveStage = requestedStage ?? (invoice.payment_status === "paid" ? "paid" : "approved");
  const { data } = await supabase.from("chillbros_document_archives").select("pdf_base64,sha256,created_at").eq("invoice_id", invoice.id).eq("stage", stage).maybeSingle();
  if (!data) return null;
  return { buffer: Buffer.from(data.pdf_base64, "base64"), sha256: data.sha256, createdAt: data.created_at, filename: `${invoice.invoice_number}-${stage}.pdf` };
}
