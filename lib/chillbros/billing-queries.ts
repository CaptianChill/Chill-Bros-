import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type { InvoiceAdjustmentType, InvoiceStatus, PaymentStatus, PaymentTerms } from "@/lib/chillbros/types";

export type InvoiceCenterAdjustment = { id: string; type: InvoiceAdjustmentType; amount: number; reason: string; createdAt: string };
export type InvoiceCenterRow = {
  id: string;
  invoiceNumber: string;
  portalToken: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerTaxExempt: boolean;
  customerTaxExemptNote: string | null;
  jobId: string | null;
  jobStatus: string | null;
  jobLocation: string | null;
  jobScope: string | null;
  technicianName: string | null;
  equipment: string[];
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  creditAmount: number;
  refundAmount: number;
  total: number;
  downPaymentAmount: number;
  downPaymentStatus: PaymentStatus;
  paymentTerms: PaymentTerms;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  lastReminderAt: string | null;
  reminderCount: number;
  agingBucket: string;
  daysOverdue: number;
  hasApprovedArchive: boolean;
  hasPaidArchive: boolean;
  receiptNumber: string | null;
  latestDelivery: { channel: string; type: string; status: string; createdAt: string } | null;
  adjustments: InvoiceCenterAdjustment[];
  createdAt: string;
  updatedAt: string;
};

export type InvoiceCenterMetrics = {
  outstandingValue: number;
  dueToday: number;
  overdueValue: number;
  collectedThisMonth: number;
  pendingApproval: number;
  averageDaysToPay: number;
};

function unique(values: Array<string | null | undefined>) { return [...new Set(values.filter((value): value is string => Boolean(value)))]; }
function dayKey(value: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(value); }
function daysBetween(a: string, b: string) { return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)); }

export async function getInvoiceCenterData(): Promise<{ rows: InvoiceCenterRow[]; metrics: InvoiceCenterMetrics }> {
  const supabase = createServiceRoleClient();
  const { data: invoices, error } = await supabase.from("chillbros_invoices").select("id,invoice_number,portal_token,status,payment_status,customer_id,job_id,discount_amount,down_payment_amount,down_payment_status,tax_rate,tax_amount,issued_at,payment_terms,due_at,last_reminder_at,reminder_count,paid_at,created_at,updated_at").order("updated_at", { ascending: false }).limit(300);
  if (error || !invoices?.length) return { rows: [], metrics: { outstandingValue: 0, dueToday: 0, overdueValue: 0, collectedThisMonth: 0, pendingApproval: 0, averageDaysToPay: 0 } };

  const invoiceIds = invoices.map((row) => row.id);
  const customerIds = unique(invoices.map((row) => row.customer_id));
  const jobIds = unique(invoices.map((row) => row.job_id));

  const [lineResult, adjustmentResult, archiveResult, receiptResult, deliveryResult, customerResult, jobResult, equipmentResult] = await Promise.all([
    supabase.from("chillbros_invoice_line_items").select("invoice_id,amount").in("invoice_id", invoiceIds),
    supabase.from("chillbros_invoice_adjustments").select("id,invoice_id,adjustment_type,amount,reason,created_at").in("invoice_id", invoiceIds).order("created_at", { ascending: false }),
    supabase.from("chillbros_document_archives").select("invoice_id,stage").in("invoice_id", invoiceIds),
    supabase.from("chillbros_receipts").select("invoice_id,receipt_number").in("invoice_id", invoiceIds),
    supabase.from("chillbros_delivery_log").select("invoice_id,channel,delivery_type,status,created_at").in("invoice_id", invoiceIds).order("created_at", { ascending: false }),
    customerIds.length ? supabase.from("chillbros_customers").select("id,name,email,phone,tax_exempt,tax_exempt_note").in("id", customerIds) : Promise.resolve({ data: [] }),
    jobIds.length ? supabase.from("chillbros_jobs").select("id,status,location,scope,assigned_tech_id").in("id", jobIds) : Promise.resolve({ data: [] }),
    customerIds.length ? supabase.from("chillbros_equipment").select("id,customer_id,asset_tag,equipment_type,manufacturer,model,serial_number").in("customer_id", customerIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);

  const technicianIds = unique((jobResult.data ?? []).map((job) => job.assigned_tech_id));
  const { data: techs } = technicianIds.length ? await supabase.from("chillbros_profiles").select("id,full_name").in("id", technicianIds) : { data: [] as { id: string; full_name: string }[] };

  const customerMap = new Map((customerResult.data ?? []).map((row) => [row.id, row]));
  const jobMap = new Map((jobResult.data ?? []).map((row) => [row.id, row]));
  const techMap = new Map((techs ?? []).map((row) => [row.id, row.full_name]));
  const subtotalMap = new Map<string, number>();
  for (const row of lineResult.data ?? []) subtotalMap.set(row.invoice_id, (subtotalMap.get(row.invoice_id) ?? 0) + Number(row.amount ?? 0));

  const adjustmentsMap = new Map<string, InvoiceCenterAdjustment[]>();
  for (const row of adjustmentResult.data ?? []) {
    const list = adjustmentsMap.get(row.invoice_id) ?? [];
    list.push({ id: row.id, type: row.adjustment_type as InvoiceAdjustmentType, amount: Number(row.amount ?? 0), reason: row.reason, createdAt: row.created_at });
    adjustmentsMap.set(row.invoice_id, list);
  }
  const archiveMap = new Map<string, Set<string>>();
  for (const row of archiveResult.data ?? []) { const set = archiveMap.get(row.invoice_id) ?? new Set<string>(); set.add(row.stage); archiveMap.set(row.invoice_id, set); }
  const receiptMap = new Map((receiptResult.data ?? []).map((row) => [row.invoice_id, row.receipt_number]));
  const deliveryMap = new Map<string, { channel: string; type: string; status: string; createdAt: string }>();
  for (const row of deliveryResult.data ?? []) if (!deliveryMap.has(row.invoice_id)) deliveryMap.set(row.invoice_id, { channel: row.channel, type: row.delivery_type, status: row.status, createdAt: row.created_at });

  const equipmentMap = new Map<string, string[]>();
  for (const item of equipmentResult.data ?? []) {
    const list = equipmentMap.get(item.customer_id) ?? [];
    if (list.length < 4) list.push([item.asset_tag, item.manufacturer, item.model || item.equipment_type].filter(Boolean).join(" · "));
    equipmentMap.set(item.customer_id, list);
  }

  const today = new Date();
  const todayKey = dayKey(today);
  const monthKey = todayKey.slice(0, 7);
  const rows: InvoiceCenterRow[] = invoices.map((invoice) => {
    const customer = customerMap.get(invoice.customer_id);
    const job = invoice.job_id ? jobMap.get(invoice.job_id) : null;
    const adjustments = adjustmentsMap.get(invoice.id) ?? [];
    const creditAmount = adjustments.filter((entry) => entry.type === "credit").reduce((sum, entry) => sum + entry.amount, 0);
    const refundAmount = adjustments.filter((entry) => entry.type === "refund").reduce((sum, entry) => sum + entry.amount, 0);
    const subtotal = subtotalMap.get(invoice.id) ?? 0;
    const total = Math.max(0, subtotal - Number(invoice.discount_amount ?? 0) + Number(invoice.tax_amount ?? 0) - creditAmount);
    const isOutstanding = invoice.status === "approved" && invoice.payment_status !== "paid";
    const dueMs = invoice.due_at ? new Date(invoice.due_at).getTime() : Number.NaN;
    const daysOverdue = isOutstanding && Number.isFinite(dueMs) && dueMs < today.getTime() ? Math.max(1, Math.ceil((today.getTime() - dueMs) / 86400000)) : 0;
    const agingBucket = !isOutstanding ? "—" : daysOverdue <= 0 ? "Current" : daysOverdue <= 30 ? "1–30" : daysOverdue <= 60 ? "31–60" : daysOverdue <= 90 ? "61–90" : "90+";
    const archives = archiveMap.get(invoice.id) ?? new Set<string>();
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      portalToken: invoice.portal_token,
      status: invoice.status as InvoiceStatus,
      paymentStatus: invoice.payment_status as PaymentStatus,
      customerId: invoice.customer_id,
      customerName: customer?.name ?? "Unknown customer",
      customerEmail: customer?.email ?? null,
      customerPhone: customer?.phone ?? null,
      customerTaxExempt: Boolean(customer?.tax_exempt),
      customerTaxExemptNote: customer?.tax_exempt_note ?? null,
      jobId: invoice.job_id,
      jobStatus: job?.status ?? null,
      jobLocation: job?.location ?? null,
      jobScope: job?.scope ?? null,
      technicianName: job?.assigned_tech_id ? techMap.get(job.assigned_tech_id) ?? null : null,
      equipment: equipmentMap.get(invoice.customer_id) ?? [],
      subtotal,
      discountAmount: Number(invoice.discount_amount ?? 0),
      taxRate: Number(invoice.tax_rate ?? 0),
      taxAmount: Number(invoice.tax_amount ?? 0),
      creditAmount,
      refundAmount,
      total,
      downPaymentAmount: Number(invoice.down_payment_amount ?? 0),
      downPaymentStatus: invoice.down_payment_status as PaymentStatus,
      paymentTerms: (invoice.payment_terms ?? "due_on_receipt") as PaymentTerms,
      issuedAt: invoice.issued_at,
      dueAt: invoice.due_at,
      paidAt: invoice.paid_at,
      lastReminderAt: invoice.last_reminder_at,
      reminderCount: Number(invoice.reminder_count ?? 0),
      agingBucket,
      daysOverdue,
      hasApprovedArchive: archives.has("approved"),
      hasPaidArchive: archives.has("paid"),
      receiptNumber: receiptMap.get(invoice.id) ?? null,
      latestDelivery: deliveryMap.get(invoice.id) ?? null,
      adjustments,
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at,
    };
  });

  const outstanding = rows.filter((row) => row.status === "approved" && row.paymentStatus !== "paid");
  const paidThisMonth = rows.filter((row) => row.paymentStatus === "paid" && row.paidAt && dayKey(new Date(row.paidAt)).slice(0, 7) === monthKey);
  const paidDurations = rows.filter((row) => row.paymentStatus === "paid" && row.paidAt && row.issuedAt).map((row) => daysBetween(row.issuedAt!, row.paidAt!));
  const metrics: InvoiceCenterMetrics = {
    outstandingValue: outstanding.reduce((sum, row) => sum + row.total, 0),
    dueToday: outstanding.filter((row) => row.dueAt && dayKey(new Date(row.dueAt)) === todayKey).length,
    overdueValue: outstanding.filter((row) => row.daysOverdue > 0).reduce((sum, row) => sum + row.total, 0),
    collectedThisMonth: paidThisMonth.reduce((sum, row) => sum + Math.max(0, row.total - row.refundAmount), 0),
    pendingApproval: rows.filter((row) => row.status === "awaiting_approval").length,
    averageDaysToPay: paidDurations.length ? paidDurations.reduce((sum, value) => sum + value, 0) / paidDurations.length : 0,
  };
  return { rows, metrics };
}

export async function getReceiptByInvoiceToken(token: string) {
  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase.from("chillbros_invoices").select("id,invoice_number,customer_id,payment_method,paid_at,customer:chillbros_customers(name)").eq("portal_token", token).eq("payment_status", "paid").is("revoked_at", null).maybeSingle();
  if (!invoice) return null;
  const { data: receipt } = await supabase.from("chillbros_receipts").select("id,receipt_number,portal_token,amount,payment_method,paid_at,created_at").eq("invoice_id", invoice.id).maybeSingle();
  if (!receipt) return null;
  const customer = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
  return { ...receipt, invoiceNumber: invoice.invoice_number, customerName: customer?.name ?? "Unknown customer" };
}
