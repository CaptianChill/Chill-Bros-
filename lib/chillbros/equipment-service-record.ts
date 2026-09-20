import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

export type EquipmentServiceRecord = {
  equipment: {
    id: string;
    customerId: string;
    customerName: string;
    assetTag: string | null;
    equipmentType: string;
    manufacturer: string | null;
    model: string | null;
    serialNumber: string | null;
    refrigerant: string | null;
    notes: string | null;
  };
  jobs: Array<{
    id: string;
    status: string;
    location: string | null;
    scope: string | null;
    workPerformed: string | null;
    laborHours: number;
    driveHours: number;
    scheduledWindow: string | null;
    createdAt: string;
    technicianName: string | null;
    invoiceNumber: string | null;
    paymentStatus: string | null;
  }>;
  events: Array<{ id: string; jobId: string | null; stage: string; message: string; createdAt: string }>;
};

export async function getEquipmentServiceRecord(equipmentId: string): Promise<EquipmentServiceRecord | null> {
  const supabase = createServiceRoleClient();
  const { data: equipment } = await supabase
    .from("chillbros_equipment")
    .select("id,customer_id,asset_tag,equipment_type,manufacturer,model,serial_number,refrigerant,notes,customer:chillbros_customers(name)")
    .eq("id", equipmentId)
    .maybeSingle();
  if (!equipment) return null;

  const { data: jobs } = await supabase
    .from("chillbros_jobs")
    .select("id,status,location,scope,work_performed,labor_hours,drive_hours,scheduled_window,created_at,tech:chillbros_profiles!chillbros_jobs_assigned_tech_id_fkey(full_name)")
    .eq("equipment_id", equipmentId)
    .order("created_at", { ascending: false });

  const jobIds = (jobs ?? []).map((job) => job.id);
  const [{ data: invoices }, { data: events }] = jobIds.length ? await Promise.all([
    supabase.from("chillbros_invoices").select("job_id,invoice_number,payment_status,updated_at").in("job_id", jobIds).is("revoked_at", null).neq("status", "void").order("updated_at", { ascending: false }),
    supabase.from("chillbros_workflow_events").select("id,job_id,stage,message,created_at").in("job_id", jobIds).order("created_at", { ascending: false }).limit(100),
  ]) : [{ data: [] }, { data: [] }];

  const invoiceByJob = new Map<string, { invoice_number: string; payment_status: string }>();
  for (const invoice of invoices ?? []) if (invoice.job_id && !invoiceByJob.has(invoice.job_id)) invoiceByJob.set(invoice.job_id, invoice);
  const customer = Array.isArray(equipment.customer) ? equipment.customer[0] : equipment.customer;

  return {
    equipment: {
      id: equipment.id,
      customerId: equipment.customer_id,
      customerName: customer?.name ?? "Unknown customer",
      assetTag: equipment.asset_tag,
      equipmentType: equipment.equipment_type,
      manufacturer: equipment.manufacturer,
      model: equipment.model,
      serialNumber: equipment.serial_number,
      refrigerant: equipment.refrigerant,
      notes: equipment.notes,
    },
    jobs: (jobs ?? []).map((job) => {
      const tech = Array.isArray(job.tech) ? job.tech[0] : job.tech;
      const invoice = invoiceByJob.get(job.id);
      return {
        id: job.id,
        status: job.status,
        location: job.location,
        scope: job.scope,
        workPerformed: job.work_performed,
        laborHours: Number(job.labor_hours ?? 0),
        driveHours: Number(job.drive_hours ?? 0),
        scheduledWindow: job.scheduled_window,
        createdAt: job.created_at,
        technicianName: tech?.full_name ?? null,
        invoiceNumber: invoice?.invoice_number ?? null,
        paymentStatus: invoice?.payment_status ?? null,
      };
    }),
    events: (events ?? []).map((event) => ({ id: event.id, jobId: event.job_id, stage: event.stage, message: event.message, createdAt: event.created_at })),
  };
}
