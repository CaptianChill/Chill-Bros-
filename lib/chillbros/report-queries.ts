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
  const [{ data: jobs }, { data: invoices }, { data: lineItems }, { data: adjustments }, { data: timesheets }, { data: parts }] = await Promise.all([
    supabase.from("chillbros_jobs").select("id,status"),
    supabase.from("chillbros_invoices").select("id,invoice_number,status,payment_status,discount_amount,tax_amount,revoked_at,customer:chillbros_customers(name)").is("revoked_at", null).order("updated_at", { ascending: false }),
    supabase.from("chillbros_invoice_line_items").select("invoice_id,amount"),
    supabase.from("chillbros_invoice_adjustments").select("invoice_id,adjustment_type,amount"),
    supabase.from("chillbros_timesheets").select("id,labor_hours,drive_hours"),
    supabase.from("chillbros_parts_catalog").select("part_number,stock,default_cost,retail_price,track_inventory"),
  ]);
  const inventoryParts = (parts ?? []).filter((row) => row.track_inventory);
  const subtotals = new Map<string, number>();
  for (const row of lineItems ?? []) subtotals.set(row.invoice_id, (subtotals.get(row.invoice_id) ?? 0) + Number(row.amount ?? 0));
  const credits = new Map<string, number>();
  const refunds = new Map<string, number>();
  for (const row of adjustments ?? []) {
    const map = row.adjustment_type === "refund" ? refunds : credits;
    map.set(row.invoice_id, (map.get(row.invoice_id) ?? 0) + Number(row.amount ?? 0));
  }
  const invoiceRows: ReportInvoice[] = (invoices ?? []).map((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    const total = Math.max(0, (subtotals.get(row.id) ?? 0) - Number(row.discount_amount ?? 0) + Number(row.tax_amount ?? 0) - (credits.get(row.id) ?? 0));
    return { id: row.id, invoiceNumber: row.invoice_number, customerName: customer?.name ?? "Unknown customer", status: row.status, paymentStatus: row.payment_status, total };
  });
  return {
    jobs: { scheduled: (jobs ?? []).filter((j) => j.status === "scheduled").length, inProgress: (jobs ?? []).filter((j) => j.status === "in_progress").length, completed: (jobs ?? []).filter((j) => j.status === "completed").length, cancelled: (jobs ?? []).filter((j) => j.status === "cancelled").length },
    invoices: {
      total: invoiceRows.length,
      awaitingApproval: invoiceRows.filter((i) => i.status === "awaiting_approval").length,
      approved: invoiceRows.filter((i) => i.status === "approved").length,
      paid: invoiceRows.filter((i) => i.paymentStatus === "paid").length,
      outstanding: invoiceRows.filter((i) => i.status === "approved" && i.paymentStatus !== "paid").length,
      paidRevenue: invoiceRows.filter((i) => i.paymentStatus === "paid").reduce((sum, i) => sum + Math.max(0, i.total - (refunds.get(i.id) ?? 0)), 0),
      outstandingValue: invoiceRows.filter((i) => i.status === "approved" && i.paymentStatus !== "paid").reduce((sum, i) => sum + i.total, 0),
    },
    time: { sessions: (timesheets ?? []).length, laborHours: (timesheets ?? []).reduce((sum, row) => sum + Number(row.labor_hours ?? 0), 0), driveHours: (timesheets ?? []).reduce((sum, row) => sum + Number(row.drive_hours ?? 0), 0) },
    inventory: { parts: inventoryParts.length, units: inventoryParts.reduce((sum, row) => sum + Number(row.stock ?? 0), 0), costValue: inventoryParts.reduce((sum, row) => sum + Number(row.stock ?? 0) * Number(row.default_cost ?? 0), 0), retailValue: inventoryParts.reduce((sum, row) => sum + Number(row.stock ?? 0) * Number(row.retail_price ?? 0), 0), lowStock: inventoryParts.filter((row) => Number(row.stock ?? 0) < 5).length },
    invoiceRows,
  };
}
