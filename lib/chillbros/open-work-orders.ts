import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { JOB_ACTIVE_STATUSES, type JobStatus } from "./types";

export type OpenWorkOrderRow = {
  id: string;
  jobNumber: string | null;
  customerName: string;
  location: string | null;
  scope: string | null;
  status: JobStatus;
  assignedTechId: string | null;
  assignedTechName: string | null;
  scheduledWindow: string | null;
  createdAt: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  paymentStatus: string | null;
};

type NamedRelation = { name: string | null };
type TechnicianRelation = { full_name: string | null };
type InvoiceRelation = {
  id: string;
  invoice_number: string | null;
  status: string | null;
  payment_status: string | null;
  updated_at: string | null;
};
type OpenWorkOrderRecord = {
  id: string;
  job_number: string | null;
  status: JobStatus;
  assigned_tech_id: string | null;
  location: string | null;
  scope: string | null;
  scheduled_window: string | null;
  created_at: string;
  customer: NamedRelation | NamedRelation[] | null;
  tech: TechnicianRelation | TechnicianRelation[] | null;
  invoice: InvoiceRelation | InvoiceRelation[] | null;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getOpenWorkOrders(): Promise<OpenWorkOrderRow[]> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("chillbros_jobs")
    .select("id,job_number,status,assigned_tech_id,location,scope,scheduled_window,created_at,customer:chillbros_customers(name),tech:chillbros_profiles!chillbros_jobs_assigned_tech_id_fkey(full_name),invoice:chillbros_invoices(id,invoice_number,status,payment_status,updated_at)")
    .is("archived_at", null)
    .in("status", JOB_ACTIVE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[open-work-orders] Neon query failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error("Could not load open work orders.");
  }
  if (!data) return [];

  return (data as unknown as OpenWorkOrderRecord[]).map((record) => {
    const customer = first(record.customer);
    const technician = first(record.tech);
    const invoices = (Array.isArray(record.invoice) ? record.invoice : record.invoice ? [record.invoice] : [])
      .filter((invoice) => invoice.status !== "void")
      .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));
    const invoice = invoices[0] ?? null;

    return {
      id: record.id,
      jobNumber: record.job_number ?? null,
      customerName: customer?.name ?? "Unknown customer",
      location: record.location,
      scope: record.scope,
      status: record.status,
      assignedTechId: record.assigned_tech_id,
      assignedTechName: technician?.full_name ?? null,
      scheduledWindow: record.scheduled_window,
      createdAt: record.created_at,
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.invoice_number ?? null,
      invoiceStatus: invoice?.status ?? null,
      paymentStatus: invoice?.payment_status ?? null,
    };
  });
}
