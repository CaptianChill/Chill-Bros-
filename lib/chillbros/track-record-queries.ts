import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { buildTrackRecord, type TrackInvoice, type TrackJob } from "@/lib/chillbros/track-record";

// Read-only. Pages through every row so the record covers the company's full history.
async function allRows<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await load(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

type InvoiceRow = { id: string; invoice_number: string; customer_id: string | null; status: string; payment_status: string; payment_method: string | null; issued_at: string | null; paid_at: string | null; created_at: string | null; converted_invoice_id: string | null; revoked_at: string | null; discount_amount: number | null; tax_amount: number | null; customer: { name: string | null } | { name: string | null }[] | null };

export async function getTrackRecord() {
  const supabase = createServiceRoleClient();
  const [jobs, invoices, lineItems, adjustments] = await Promise.all([
    allRows<{ id: string; customer_id: string | null; status: string; created_at: string | null; archived_at: string | null }>((a, b) => supabase.from("chillbros_jobs").select("id,customer_id,status,created_at,archived_at").order("created_at", { ascending: true }).range(a, b)),
    allRows<InvoiceRow>((a, b) => supabase.from("chillbros_invoices").select("id,invoice_number,customer_id,status,payment_status,payment_method,issued_at,paid_at,created_at,converted_invoice_id,revoked_at,discount_amount,tax_amount,customer:chillbros_customers(name)").order("created_at", { ascending: true }).range(a, b)),
    allRows<{ invoice_id: string; amount: number | null }>((a, b) => supabase.from("chillbros_invoice_line_items").select("invoice_id,amount").order("invoice_id").range(a, b)),
    allRows<{ invoice_id: string; adjustment_type: string; amount: number | null }>((a, b) => supabase.from("chillbros_invoice_adjustments").select("invoice_id,adjustment_type,amount").order("invoice_id").range(a, b)),
  ]);

  const subtotals = new Map<string, number>();
  for (const row of lineItems) subtotals.set(row.invoice_id, (subtotals.get(row.invoice_id) ?? 0) + Number(row.amount ?? 0));
  const credits = new Map<string, number>();
  const refunds = new Map<string, number>();
  for (const row of adjustments) {
    const map = row.adjustment_type === "refund" ? refunds : credits;
    map.set(row.invoice_id, (map.get(row.invoice_id) ?? 0) + Number(row.amount ?? 0));
  }

  const trackJobs: TrackJob[] = jobs.map((j) => ({ id: j.id, customerId: j.customer_id, status: j.status, createdAt: j.created_at, archivedAt: j.archived_at }));
  const trackInvoices: TrackInvoice[] = invoices.map((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    return {
      id: row.id,
      invoiceNumber: row.invoice_number ?? "",
      customerId: row.customer_id,
      customerName: customer?.name ?? "Unknown customer",
      status: row.status,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      issuedAt: row.issued_at,
      paidAt: row.paid_at,
      createdAt: row.created_at,
      convertedInvoiceId: row.converted_invoice_id,
      revokedAt: row.revoked_at,
      subtotal: subtotals.get(row.id) ?? 0,
      discount: Number(row.discount_amount ?? 0),
      tax: Number(row.tax_amount ?? 0),
      credits: credits.get(row.id) ?? 0,
      refunds: refunds.get(row.id) ?? 0,
    };
  });
  return buildTrackRecord(trackJobs, trackInvoices);
}
