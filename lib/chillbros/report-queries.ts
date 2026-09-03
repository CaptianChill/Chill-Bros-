import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

export type ReportInvoice = { id: string; invoiceNumber: string; customerName: string; status: string; paymentStatus: string; total: number };
export type OperationsReport = {
  jobs: { scheduled: number; inProgress: number; completed: number; cancelled: number };
  invoices: { total: number; awaitingApproval: number; approved: number; paid: number; outstanding: number; paidRevenue: number; outstandingValue: number };
  time: { sessions: number; laborHours: number; driveHours: number };
  inventory: { parts: number; units: number; costValue: number; retailValue: number; lowStock: number };
  invoiceRows: ReportInvoice[];
};

export async function getOperationsReport(): Promise<OperationsReport> {
  const supabase = createServiceRoleClient();
  const [{ data: jobs }, { data: invoices }, { data: lineItems }, { data: timesheets }, { data: parts }] = await Promise.all([
    supabase.from("chillbros_jobs").select("id,status"),
    supabase.from("chillbros_invoices").select("id,invoice_number,status,payment_status,revoked_at,customer:chillbros_customers(name)").is("revoked_at", null).order("updated_at", { ascending: false }),
    supabase.from("chillbros_invoice_line_items").select("invoice_id,amount"),
    supabase.from("chillbros_timesheets").select("id,labor_hours,drive_hours"),
    supabase.from("chillbros_parts_catalog").select("stock,default_cost,retail_price"),
  ]);

  const totals = new Map<string, number>();
  for (const row of lineItems ?? []) totals.set(row.invoice_id, (totals.get(row.invoice_id) ?? 0) + Number(row.amount ?? 0));
  const invoiceRows: ReportInvoice[] = (invoices ?? []).map((row) => { const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer; return { id: row.id, invoiceNumber: row.invoice_number, customerName: customer?.name ?? "Unknown customer", status: row.status, paymentStatus: row.payment_status, total: totals.get(row.id) ?? 0 }; });

  return {
    jobs: {
      scheduled: (jobs ?? []).filter((j) => j.status === "scheduled").length,
      inProgress: (jobs ?? []).filter((j) => j.status === "in_progress").length,
      completed: (jobs ?? []).filter((j) => j.status === "completed").length,
      cancelled: (jobs ?? []).filter((j) => j.status === "cancelled").length,
    },
    invoices: {
      total: invoiceRows.length,
      awaitingApproval: invoiceRows.filter((i) => i.status === "awaiting_approval").length,
      approved: invoiceRows.filter((i) => i.status === "approved").length,
      paid: invoiceRows.filter((i) => i.paymentStatus === "paid").length,
      outstanding: invoiceRows.filter((i) => i.status === "approved" && i.paymentStatus !== "paid").length,
      paidRevenue: invoiceRows.filter((i) => i.paymentStatus === "paid").reduce((sum, i) => sum + i.total, 0),
      outstandingValue: invoiceRows.filter((i) => i.status === "approved" && i.paymentStatus !== "paid").reduce((sum, i) => sum + i.total, 0),
    },
    time: {
      sessions: (timesheets ?? []).length,
      laborHours: (timesheets ?? []).reduce((sum, row) => sum + Number(row.labor_hours ?? 0), 0),
      driveHours: (timesheets ?? []).reduce((sum, row) => sum + Number(row.drive_hours ?? 0), 0),
    },
    inventory: {
      parts: (parts ?? []).length,
      units: (parts ?? []).reduce((sum, row) => sum + Number(row.stock ?? 0), 0),
      costValue: (parts ?? []).reduce((sum, row) => sum + Number(row.stock ?? 0) * Number(row.default_cost ?? 0), 0),
      retailValue: (parts ?? []).reduce((sum, row) => sum + Number(row.stock ?? 0) * Number(row.retail_price ?? 0), 0),
      lowStock: (parts ?? []).filter((row) => Number(row.stock ?? 0) < 5).length,
    },
    invoiceRows,
  };
}
