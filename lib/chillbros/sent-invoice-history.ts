import "server-only";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

/**
 * Owner-only history of every quote/invoice that went out to a customer.
 *
 * Read-only. Unlike the Invoice Center and the customer portal, this keeps
 * voided and revoked documents visible, because the owner needs a permanent
 * record of what was actually sent — not just what is still active.
 *
 * "Sent" = the document was issued (issued_at set) OR the delivery log has a
 * successful email/text to the customer for it.
 */

const OWNER_EMAIL = "chillprostx@gmail.com";

export async function getOwnerProfile() {
  const profile = await getCurrentStaffProfile();
  return profile?.role === "manager" && profile.email.trim().toLowerCase() === OWNER_EMAIL ? profile : null;
}

export type SentDelivery = { channel: string; type: string; recipient: string; createdAt: string };

export type SentInvoiceRow = {
  id: string;
  invoiceNumber: string;
  kind: "invoice" | "quote";
  customerName: string;
  customerEmail: string | null;
  total: number;
  state: "paid" | "unpaid" | "void" | "converted" | "awaiting_approval";
  firstSentAt: string | null;
  lastSentAt: string | null;
  sendCount: number;
  paidAt: string | null;
  archiveStages: string[];
};

export type SentInvoiceCopy = SentInvoiceRow & {
  customerPhone: string | null;
  jobLocation: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  notes: string | null;
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  creditAmount: number;
  refundAmount: number;
  signatureName: string | null;
  signedAt: string | null;
  paymentMethod: string | null;
  receiptNumber: string | null;
  lineItems: { label: string; description: string | null; quantity: number; unitPrice: number; amount: number }[];
  deliveries: SentDelivery[];
};

export const STATE_LABEL: Record<SentInvoiceRow["state"], { label: string; tone: "emerald" | "amber" | undefined }> = {
  paid: { label: "Paid", tone: "emerald" },
  unpaid: { label: "Unpaid", tone: "amber" },
  awaiting_approval: { label: "Awaiting approval", tone: "amber" },
  converted: { label: "Converted to invoice", tone: undefined },
  void: { label: "Voided", tone: undefined },
};

type InvoiceRecord = {
  id: string; invoice_number: string; status: string; payment_status: string; customer_id: string; job_id: string | null;
  converted_invoice_id: string | null; revoked_at: string | null; issued_at: string | null; due_at: string | null; paid_at: string | null;
  discount_amount: number | null; tax_rate: number | null; tax_amount: number | null; notes: string | null;
  signature_name: string | null; signed_at: string | null; payment_method: string | null; created_at: string;
};

const INVOICE_COLUMNS = "id,invoice_number,status,payment_status,customer_id,job_id,converted_invoice_id,revoked_at,issued_at,due_at,paid_at,discount_amount,tax_rate,tax_amount,notes,signature_name,signed_at,payment_method,created_at";
const CUSTOMER_FACING_TYPES = ["invoice", "estimate", "reminder", "receipt"];

function kindOf(invoice: Pick<InvoiceRecord, "invoice_number" | "issued_at">): "invoice" | "quote" {
  const number = invoice.invoice_number.toUpperCase();
  if (number.startsWith("Q-") || number.startsWith("E-")) return "quote";
  return invoice.issued_at || number.startsWith("I-") || number.startsWith("INV-") ? "invoice" : "quote";
}

function stateOf(invoice: InvoiceRecord): SentInvoiceRow["state"] {
  if (invoice.status === "void" || invoice.revoked_at) return "void";
  if (invoice.payment_status === "paid") return "paid";
  if (invoice.converted_invoice_id) return "converted";
  if (invoice.status === "awaiting_approval" || invoice.status === "draft") return "awaiting_approval";
  return "unpaid";
}

async function loadRows(filter: { ids?: string[] }) {
  const supabase = createServiceRoleClient();

  // Every invoice id that has a successful customer-facing send.
  const { data: sends, error: sendError } = await supabase
    .from("chillbros_delivery_log")
    .select("invoice_id,channel,delivery_type,recipient,created_at")
    .eq("status", "sent")
    .in("delivery_type", CUSTOMER_FACING_TYPES)
    .not("invoice_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (sendError) throw new Error(`Send history could not load: ${sendError.message}`);

  const sentIds = new Set((sends ?? []).map((row) => row.invoice_id as string));

  let invoiceQuery = supabase.from("chillbros_invoices").select(INVOICE_COLUMNS).order("created_at", { ascending: false }).limit(2000);
  if (filter.ids) invoiceQuery = invoiceQuery.in("id", filter.ids);
  const { data: allInvoices, error: invoiceError } = await invoiceQuery;
  if (invoiceError) throw new Error(`Invoices could not load: ${invoiceError.message}`);

  const invoices = ((allInvoices ?? []) as InvoiceRecord[]).filter((invoice) => invoice.issued_at || sentIds.has(invoice.id));
  if (!invoices.length) return { invoices, sends: [], lines: [], customers: [], archives: [], adjustments: [], receipts: [], jobs: [] };

  const ids = invoices.map((invoice) => invoice.id);
  const customerIds = [...new Set(invoices.map((invoice) => invoice.customer_id))];
  const jobIds = [...new Set(invoices.map((invoice) => invoice.job_id).filter(Boolean) as string[])];

  const [lineResult, customerResult, archiveResult, adjustmentResult, receiptResult, jobResult] = await Promise.all([
    supabase.from("chillbros_invoice_line_items").select("invoice_id,label,description,quantity,unit_price,amount,sort_order").in("invoice_id", ids).order("sort_order", { ascending: true }),
    supabase.from("chillbros_customers").select("id,name,email,phone").in("id", customerIds),
    supabase.from("chillbros_document_archives").select("invoice_id,stage").in("invoice_id", ids),
    supabase.from("chillbros_invoice_adjustments").select("invoice_id,adjustment_type,amount").in("invoice_id", ids),
    supabase.from("chillbros_receipts").select("invoice_id,receipt_number").in("invoice_id", ids),
    jobIds.length ? supabase.from("chillbros_jobs").select("id,location").in("id", jobIds) : Promise.resolve({ data: [] as { id: string; location: string | null }[], error: null }),
  ]);
  for (const result of [lineResult, customerResult, archiveResult, adjustmentResult, receiptResult]) {
    if (result.error) throw new Error(`Invoice details could not load: ${result.error.message}`);
  }

  return {
    invoices,
    sends: (sends ?? []).filter((row) => ids.includes(row.invoice_id as string)),
    lines: lineResult.data ?? [],
    customers: customerResult.data ?? [],
    archives: archiveResult.data ?? [],
    adjustments: adjustmentResult.data ?? [],
    receipts: receiptResult.data ?? [],
    jobs: jobResult.data ?? [],
  };
}

function build(data: Awaited<ReturnType<typeof loadRows>>): SentInvoiceCopy[] {
  const customers = new Map(data.customers.map((row) => [row.id, row]));
  const jobs = new Map(data.jobs.map((row) => [row.id, row.location]));
  const receipts = new Map(data.receipts.map((row) => [row.invoice_id, row.receipt_number]));

  return data.invoices.map((invoice) => {
    const customer = customers.get(invoice.customer_id);
    const lineItems = data.lines.filter((row) => row.invoice_id === invoice.id).map((row) => ({
      label: row.label,
      description: row.description,
      quantity: Number(row.quantity ?? 1),
      unitPrice: Number(row.unit_price ?? row.amount ?? 0),
      amount: Number(row.amount ?? 0),
    }));
    const adjustments = data.adjustments.filter((row) => row.invoice_id === invoice.id);
    const creditAmount = adjustments.filter((row) => row.adjustment_type === "credit").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const refundAmount = adjustments.filter((row) => row.adjustment_type === "refund").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const discountAmount = Number(invoice.discount_amount ?? 0);
    const taxAmount = Number(invoice.tax_amount ?? 0);
    const deliveries: SentDelivery[] = data.sends
      .filter((row) => row.invoice_id === invoice.id)
      .map((row) => ({ channel: row.channel, type: row.delivery_type, recipient: row.recipient, createdAt: row.created_at }));
    const sendTimes = deliveries.map((row) => row.createdAt);
    const firstSentAt = [invoice.issued_at, ...sendTimes].filter(Boolean).sort()[0] ?? null;
    const lastSentAt = sendTimes.length ? sendTimes[sendTimes.length - 1] : invoice.issued_at;

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      kind: kindOf(invoice),
      customerName: customer?.name ?? "Unknown customer",
      customerEmail: customer?.email ?? null,
      customerPhone: customer?.phone ?? null,
      total: Math.max(0, subtotal - discountAmount + taxAmount - creditAmount),
      state: stateOf(invoice),
      firstSentAt,
      lastSentAt,
      sendCount: deliveries.length,
      paidAt: invoice.paid_at,
      archiveStages: data.archives.filter((row) => row.invoice_id === invoice.id).map((row) => row.stage),
      jobLocation: invoice.job_id ? jobs.get(invoice.job_id) ?? null : null,
      issuedAt: invoice.issued_at,
      dueAt: invoice.due_at,
      notes: invoice.notes,
      subtotal,
      discountAmount,
      taxRate: Number(invoice.tax_rate ?? 0),
      taxAmount,
      creditAmount,
      refundAmount,
      signatureName: invoice.signature_name,
      signedAt: invoice.signed_at,
      paymentMethod: invoice.payment_method,
      receiptNumber: receipts.get(invoice.id) ?? null,
      lineItems,
      deliveries: deliveries.reverse(),
    };
  });
}

export async function getSentInvoiceHistory(): Promise<SentInvoiceRow[]> {
  const rows = build(await loadRows({}));
  return rows.sort((a, b) => (b.lastSentAt ?? "").localeCompare(a.lastSentAt ?? ""));
}

export async function getSentInvoiceCopy(id: string): Promise<SentInvoiceCopy | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = build(await loadRows({ ids: [id] }));
  return row ?? null;
}

/** The exact PDF that was archived when the document was approved/paid. Works for voided documents too. */
export async function getOwnerArchivedPdf(id: string, requested: string | null) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase.from("chillbros_invoices").select("id,invoice_number,payment_status").eq("id", id).maybeSingle();
  if (!invoice) return null;
  const { data: archives } = await supabase.from("chillbros_document_archives").select("stage,pdf_base64,sha256").eq("invoice_id", id);
  if (!archives?.length) return null;
  const preferred = requested === "paid" || requested === "approved" ? requested : invoice.payment_status === "paid" ? "paid" : "approved";
  const archive = archives.find((row) => row.stage === preferred) ?? archives.find((row) => row.stage === "paid") ?? archives[0];
  return { buffer: Buffer.from(archive.pdf_base64, "base64"), sha256: archive.sha256, filename: `${invoice.invoice_number}-${archive.stage}.pdf` };
}
