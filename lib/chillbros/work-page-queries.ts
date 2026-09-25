import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

// Staff-only reads for the technician Work Page. Callers must already have
// checked that the viewer may open this job (see app/jobs/[id]/page.tsx).
// Nothing customer-facing (portal, PDF, email) imports this module.

const MEDIA_BUCKET = "chillbros-media";
const SIGNED_URL_SECONDS = 3600;

export type JobReceipt = { id: string; vendor: string | null; amount: number | null; note: string | null; createdAt: string; createdByName: string | null; showOnInvoice: boolean; url: string | null; isPdf: boolean };
export type JobSignature = { id: string; signerName: string | null; customerUnavailable: boolean; capturedAt: string; capturedByName: string | null; url: string | null };
export type RepairReport = { id: string; outcome: string; outcomeLabel: string; workPerformed: string; finalNotes: string; createdAt: string; technicianName: string };
export type WorkPageContext = {
  customer: { name: string; address: string | null; phone: string | null; email: string | null } | null;
  equipment: { id: string; label: string; detail: string; serialNumber: string | null; refrigerant: string | null } | null;
  jobNumber: string | null;
  partMeta: Record<string, { fieldStatus: string | null; notes: string | null }>;
};

type Named = { full_name: string } | { full_name: string }[] | null;
const nameOf = (value: Named) => (Array.isArray(value) ? value[0] : value)?.full_name ?? null;

async function signedUrls(paths: string[]) {
  const map = new Map<string, string>();
  if (!paths.length) return map;
  const { data } = await createServiceRoleClient().storage.from(MEDIA_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  for (const entry of data ?? []) if (entry.signedUrl && entry.path) map.set(entry.path, entry.signedUrl);
  return map;
}

export async function getWorkPageContext(jobId: string): Promise<WorkPageContext> {
  const supabase = createServiceRoleClient();
  const [{ data: job }, { data: parts }] = await Promise.all([
    supabase
      .from("chillbros_jobs")
      .select("job_number, customer:chillbros_customers(name,address,phone,email), equipment:chillbros_equipment(id,asset_tag,equipment_type,manufacturer,model,serial_number,refrigerant)")
      .eq("id", jobId)
      .maybeSingle(),
    supabase.from("chillbros_job_parts").select("id, field_status, notes").eq("job_id", jobId),
  ]);
  const customer = job ? (Array.isArray(job.customer) ? job.customer[0] : job.customer) : null;
  const unit = job ? (Array.isArray(job.equipment) ? job.equipment[0] : job.equipment) : null;
  return {
    jobNumber: job?.job_number ?? null,
    customer: customer ? { name: customer.name, address: customer.address, phone: customer.phone, email: customer.email } : null,
    equipment: unit
      ? {
          id: unit.id,
          label: [unit.asset_tag, unit.equipment_type].filter(Boolean).join(" · ") || "Equipment",
          detail: [unit.manufacturer, unit.model].filter(Boolean).join(" ") || "Make/model not recorded",
          serialNumber: unit.serial_number,
          refrigerant: unit.refrigerant,
        }
      : null,
    partMeta: Object.fromEntries((parts ?? []).map((row) => [row.id, { fieldStatus: row.field_status ?? null, notes: row.notes ?? null }])),
  };
}

export async function getJobReceipts(jobId: string): Promise<JobReceipt[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("chillbros_job_receipts")
    .select("id, storage_path, vendor, amount, note, created_at, show_on_invoice, creator:chillbros_profiles(full_name)")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const urls = await signedUrls(rows.map((row) => row.storage_path));
  return rows.map((row) => ({
    id: row.id,
    vendor: row.vendor,
    amount: row.amount === null ? null : Number(row.amount),
    note: row.note,
    createdAt: row.created_at,
    createdByName: nameOf(row.creator as Named),
    showOnInvoice: row.show_on_invoice,
    url: urls.get(row.storage_path) ?? null,
    isPdf: row.storage_path.endsWith(".pdf"),
  }));
}

export async function getLatestJobSignature(jobId: string): Promise<JobSignature | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("chillbros_job_signatures")
    .select("id, signer_name, storage_path, customer_unavailable, captured_at, capturer:chillbros_profiles(full_name)")
    .eq("job_id", jobId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const urls = await signedUrls(data.storage_path ? [data.storage_path] : []);
  return {
    id: data.id,
    signerName: data.signer_name,
    customerUnavailable: data.customer_unavailable,
    capturedAt: data.captured_at,
    capturedByName: nameOf(data.capturer as Named),
    url: data.storage_path ? urls.get(data.storage_path) ?? null : null,
  };
}

export async function getRepairReports(jobId: string): Promise<RepairReport[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("chillbros_workflow_events")
    .select("id, message, created_at, actor:chillbros_profiles(full_name)")
    .eq("job_id", jobId)
    .eq("stage", "repair_report")
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).flatMap((row) => {
    try {
      const parsed = JSON.parse(row.message);
      return [{
        id: row.id,
        outcome: String(parsed.outcome ?? ""),
        outcomeLabel: String(parsed.outcomeLabel ?? parsed.outcome ?? ""),
        workPerformed: String(parsed.workPerformed ?? ""),
        finalNotes: String(parsed.finalNotes ?? ""),
        createdAt: row.created_at,
        technicianName: nameOf(row.actor as Named) ?? "Unknown technician",
      }];
    } catch {
      return [];
    }
  });
}

// ---------------------------------------------------------------------------
// Technician landing / history lists.

export type JobListExtras = { equipmentLabel: string | null; invoice: { id: string; number: string; status: string; paymentStatus: string; issued: boolean } | null };

/** Equipment label and current quote/invoice for each job, in two queries. */
export async function getJobListExtras(jobIds: string[]): Promise<Record<string, JobListExtras>> {
  if (!jobIds.length) return {};
  const supabase = createServiceRoleClient();
  const [{ data: jobs }, { data: invoices }] = await Promise.all([
    supabase.from("chillbros_jobs").select("id, equipment:chillbros_equipment(asset_tag,equipment_type,manufacturer)").in("id", jobIds),
    supabase
      .from("chillbros_invoices")
      .select("id, job_id, invoice_number, status, payment_status, issued_at, updated_at")
      .in("job_id", jobIds)
      .is("revoked_at", null)
      .neq("status", "void")
      .order("updated_at", { ascending: false }),
  ]);
  const result: Record<string, JobListExtras> = {};
  for (const row of jobs ?? []) {
    const unit = Array.isArray(row.equipment) ? row.equipment[0] : row.equipment;
    result[row.id] = { equipmentLabel: unit ? [unit.asset_tag, unit.manufacturer, unit.equipment_type].filter(Boolean).join(" · ") || null : null, invoice: null };
  }
  for (const row of invoices ?? []) {
    const entry = (result[row.job_id] ??= { equipmentLabel: null, invoice: null });
    if (!entry.invoice) entry.invoice = { id: row.id, number: row.invoice_number, status: row.status, paymentStatus: row.payment_status, issued: Boolean(row.issued_at) };
  }
  return result;
}

export type HistoryJob = { id: string; customerName: string; status: string; scope: string | null; scheduledWindow: string | null; updatedAt: string };

/** Finished jobs (paid / closed) assigned to this technician, newest first. */
export async function getTechnicianJobHistory(technicianId: string, limit = 100): Promise<HistoryJob[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("chillbros_jobs")
    .select("id, status, scope, scheduled_window, updated_at, customer:chillbros_customers(name)")
    .eq("assigned_tech_id", technicianId)
    .in("status", ["paid", "completed", "invoice_sent"])
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    return { id: row.id, customerName: customer?.name ?? "Unknown customer", status: row.status, scope: row.scope, scheduledWindow: row.scheduled_window, updatedAt: row.updated_at };
  });
}
