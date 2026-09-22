import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { getEquipmentByCustomer, type EquipmentRecord } from "./equipment-queries";
import { getServiceAgreementsByCustomer, type ServiceAgreement } from "./service-agreement-queries";
import type { Customer, JobStatus } from "./types";

export type CustomerProfileJob = {
  id: string;
  jobNumber: string;
  status: JobStatus;
  assignedTechId: string | null;
  assignedTechName: string | null;
  location: string | null;
  scheduledWindow: string | null;
  scope: string | null;
  workPerformed: string | null;
  createdAt: string;
  archivedAt: string | null;
};

export type CustomerProfileDocument = {
  id: string;
  invoiceNumber: string;
  portalToken: string;
  jobId: string | null;
  status: "draft" | "awaiting_approval" | "approved" | "void";
  paymentStatus: "unpaid" | "pending_manual_review" | "paid";
  issuedAt: string | null;
  updatedAt: string;
  total: number;
};

export type CustomerProfileData = {
  customer: Customer;
  equipment: EquipmentRecord[];
  jobs: CustomerProfileJob[];
  agreements: ServiceAgreement[];
  documents: CustomerProfileDocument[];
};

export async function getCustomerProfile(customerId: string): Promise<CustomerProfileData | null> {
  const supabase = createServiceRoleClient();
  const { data: customer, error } = await supabase.from("chillbros_customers").select("id,name,address,phone,email").eq("id", customerId).maybeSingle();
  if (error || !customer) return null;

  const [{ data: history }, { data: jobs }, { data: documents }, equipment, agreements] = await Promise.all([
    supabase.from("chillbros_customer_service_history").select("note,occurred_on").eq("customer_id", customerId).order("occurred_on", { ascending: false }).limit(500),
    supabase.from("chillbros_jobs").select("id,job_number,status,location,scheduled_window,scope,work_performed,created_at,archived_at,assigned_tech_id,tech:chillbros_profiles!chillbros_jobs_assigned_tech_id_fkey(full_name)").eq("customer_id", customerId).is("archived_at", null).order("created_at", { ascending: false }).limit(500),
    supabase.from("chillbros_invoices").select("id,invoice_number,portal_token,job_id,status,payment_status,issued_at,updated_at,discount_amount,tax_amount").eq("customer_id", customerId).is("revoked_at", null).neq("status", "void").order("updated_at", { ascending: false }).limit(500),
    getEquipmentByCustomer(customerId),
    getServiceAgreementsByCustomer(customerId),
  ]);

  const invoiceIds = (documents ?? []).map((row) => row.id);
  const [{ data: lineItems }, { data: adjustments }] = invoiceIds.length
    ? await Promise.all([
        supabase.from("chillbros_invoice_line_items").select("invoice_id,amount").in("invoice_id", invoiceIds),
        supabase.from("chillbros_invoice_adjustments").select("invoice_id,adjustment_type,amount").in("invoice_id", invoiceIds),
      ])
    : [{ data: [] }, { data: [] }];
  const subtotals = new Map<string, number>();
  for (const row of lineItems ?? []) subtotals.set(row.invoice_id, (subtotals.get(row.invoice_id) ?? 0) + Number(row.amount ?? 0));
  const credits = new Map<string, number>();
  for (const row of adjustments ?? []) {
    if (row.adjustment_type === "refund") continue;
    credits.set(row.invoice_id, (credits.get(row.invoice_id) ?? 0) + Number(row.amount ?? 0));
  }
  const documentTotal = (row: { id: string; discount_amount: number | null; tax_amount: number | null }) =>
    Math.max(0, (subtotals.get(row.id) ?? 0) - Number(row.discount_amount ?? 0) + Number(row.tax_amount ?? 0) - (credits.get(row.id) ?? 0));

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      address: customer.address,
      phone: customer.phone,
      email: customer.email,
      history: (history ?? []).map((entry) => `${new Date(entry.occurred_on).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • ${entry.note}`),
    },
    equipment,
    agreements,
    documents: (documents ?? []).map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      portalToken: row.portal_token,
      jobId: row.job_id,
      status: row.status,
      paymentStatus: row.payment_status,
      issuedAt: row.issued_at,
      updatedAt: row.updated_at,
      total: documentTotal(row),
    })),
    jobs: (jobs ?? []).map((row) => {
      const tech = Array.isArray(row.tech) ? row.tech[0] : row.tech;
      const jobNumber = row.job_number ?? "JOB----";
      const when = row.scheduled_window ?? new Date(row.created_at).toLocaleDateString("en-US");
      return {
        id: row.id,
        jobNumber,
        status: row.status,
        assignedTechId: row.assigned_tech_id,
        assignedTechName: tech?.full_name ?? null,
        location: row.location,
        scheduledWindow: `${jobNumber} • ${when}`,
        scope: row.scope,
        workPerformed: row.work_performed,
        createdAt: row.created_at,
        archivedAt: row.archived_at,
      };
    }),
  };
}
