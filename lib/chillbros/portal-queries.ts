import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

// Customer-facing reads for the secure portal link. Only returns what a
// customer should see about their own unit: make/model/serial and the
// service visits recorded against that unit. Never reads internal receipts,
// technician-only notes tables, or other customers' equipment.

export type PortalEquipment = {
  id: string;
  label: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  refrigerant: string | null;
  assetTag: string | null;
};

export type PortalServiceVisit = {
  jobId: string;
  jobNumber: string | null;
  date: string;
  summary: string;
  workPerformed: string | null;
  items: string[];
  documentNumber: string | null;
  isCurrent: boolean;
};

export type PortalEquipmentHistory = { equipment: PortalEquipment | null; visits: PortalServiceVisit[] };

export async function getPortalEquipmentHistory(jobId: string | null, customerId: string): Promise<PortalEquipmentHistory> {
  if (!jobId) return { equipment: null, visits: [] };
  const supabase = createServiceRoleClient();
  const { data: job } = await supabase.from("chillbros_jobs").select("equipment_id").eq("id", jobId).maybeSingle();
  if (!job?.equipment_id) return { equipment: null, visits: [] };

  const { data: unit } = await supabase
    .from("chillbros_equipment")
    .select("id, customer_id, asset_tag, equipment_type, manufacturer, model, serial_number, refrigerant")
    .eq("id", job.equipment_id)
    .maybeSingle();
  // The unit must belong to the customer on this document.
  if (!unit || unit.customer_id !== customerId) return { equipment: null, visits: [] };

  const { data: jobs } = await supabase
    .from("chillbros_jobs")
    .select("id, job_number, status, scope, work_performed, created_at, updated_at")
    .eq("equipment_id", unit.id)
    .eq("customer_id", customerId)
    .is("archived_at", null)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(50);
  const jobIds = (jobs ?? []).map((row) => row.id);
  const { data: invoices } = jobIds.length
    ? await supabase
        .from("chillbros_invoices")
        .select("id, job_id, invoice_number, status, updated_at, line_items:chillbros_invoice_line_items(label, sort_order)")
        .in("job_id", jobIds)
        .is("revoked_at", null)
        .neq("status", "void")
        .order("updated_at", { ascending: false })
    : { data: [] };
  const invoiceByJob = new Map<string, { number: string; items: string[] }>();
  for (const row of invoices ?? []) {
    if (!row.job_id || invoiceByJob.has(row.job_id)) continue;
    const items = [...(row.line_items ?? [])].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)).map((item) => String(item.label ?? "").trim()).filter(Boolean);
    invoiceByJob.set(row.job_id, { number: row.invoice_number, items });
  }

  return {
    equipment: {
      id: unit.id,
      label: unit.equipment_type,
      manufacturer: unit.manufacturer,
      model: unit.model,
      serialNumber: unit.serial_number,
      refrigerant: unit.refrigerant,
      assetTag: unit.asset_tag,
    },
    visits: (jobs ?? []).map((row) => ({
      jobId: row.id,
      jobNumber: row.job_number,
      date: row.created_at,
      summary: String(row.scope ?? "").trim() || "Service visit",
      workPerformed: String(row.work_performed ?? "").trim() || null,
      items: invoiceByJob.get(row.id)?.items ?? [],
      documentNumber: invoiceByJob.get(row.id)?.number ?? null,
      isCurrent: row.id === jobId,
    })),
  };
}
