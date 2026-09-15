import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { JOB_ACTIVE_STATUSES, type JobStatus } from "./types";

type InvoiceLine = { amount: number | string | null };
type NamedRelation = { name: string | null };
type TechnicianRelation = { full_name: string | null };
type OwnerInvoiceRecord = {
  id: string;
  status: string;
  payment_status: string | null;
  invoice_number: string | null;
  updated_at: string;
  line: InvoiceLine | InvoiceLine[] | null;
  customer: NamedRelation | NamedRelation[] | null;
};
type OwnerJobRecord = {
  id: string;
  status: JobStatus;
  assigned_tech_id: string | null;
  scope: string | null;
  scheduled_window: string | null;
  created_at: string;
  customer: NamedRelation | NamedRelation[] | null;
  tech: TechnicianRelation | TechnicianRelation[] | null;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function invoiceTotal(record: OwnerInvoiceRecord): number {
  const lines = Array.isArray(record.line) ? record.line : record.line ? [record.line] : [];
  return lines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
}

export async function getOwnerCommandMetrics() {
  const supabase = createServiceRoleClient();
  const [{ data: jobs }, { data: invoices }, { data: techs }] = await Promise.all([
    supabase.from("chillbros_jobs").select("id,status,assigned_tech_id,scope,scheduled_window,created_at,customer:chillbros_customers(name),tech:chillbros_profiles!chillbros_jobs_assigned_tech_id_fkey(full_name)").in("status", JOB_ACTIVE_STATUSES).order("created_at", { ascending: false }).limit(300),
    supabase.from("chillbros_invoices").select("id,status,payment_status,invoice_number,updated_at,line:chillbros_invoice_line_items(amount),customer:chillbros_customers(name)").is("revoked_at", null).neq("status", "void").order("updated_at", { ascending: false }).limit(300),
    supabase.from("chillbros_profiles").select("id,full_name,role,status").eq("role", "technician").eq("status", "active"),
  ]);

  const invoiceRows = (invoices ?? []) as unknown as OwnerInvoiceRecord[];
  const jobRows = (jobs ?? []) as unknown as OwnerJobRecord[];
  const unpaid = invoiceRows.filter((record) => record.payment_status !== "paid");
  const awaiting = invoiceRows.filter((record) => record.status === "awaiting_approval");
  const activeTechIds = new Set(jobRows.map((record) => record.assigned_tech_id).filter((id): id is string => Boolean(id)));
  const attention = jobRows
    .filter((record) => !record.assigned_tech_id || ["parts_required", "return_visit_needed", "awaiting_approval", "ready_to_invoice"].includes(record.status))
    .slice(0, 12)
    .map((record) => ({
      id: record.id,
      status: record.status,
      customer: first(record.customer)?.name ?? "Unknown",
      tech: first(record.tech)?.full_name ?? null,
      scope: record.scope,
    }));

  return {
    openJobs: jobRows.length,
    unassigned: jobRows.filter((record) => !record.assigned_tech_id).length,
    emergencies: jobRows.filter((record) => /emergency|down|no cool|not cooling|freezer/i.test(String(record.scope ?? ""))).length,
    activeTechs: activeTechIds.size,
    availableTechs: Math.max(0, (techs ?? []).length - activeTechIds.size),
    unpaidAmount: unpaid.reduce((sum, record) => sum + invoiceTotal(record), 0),
    awaitingApprovalAmount: awaiting.reduce((sum, record) => sum + invoiceTotal(record), 0),
    awaitingApprovalCount: awaiting.length,
    readyToInvoice: jobRows.filter((record) => record.status === "ready_to_invoice").length,
    returnVisits: jobRows.filter((record) => record.status === "return_visit_needed").length,
    partsDelays: jobRows.filter((record) => record.status === "parts_required").length,
    attention,
  };
}
