import "server-only";

import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";

export async function captureCompletedJobKnowledge(jobId: string, invoiceId: string, technicianId?: string | null) {
  const supabase = createServiceRoleClient();

  const { data: job, error: jobError } = await supabase
    .from("chillbros_jobs")
    .select("id,customer_id,equipment_id,scope,work_performed,assigned_tech_id")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError || !job) return { ok: false as const, error: jobError?.message ?? "Job not found." };

  const [{ data: equipment }, { data: partRows }] = await Promise.all([
    job.equipment_id
      ? supabase.from("chillbros_equipment").select("id,asset_tag,equipment_type,manufacturer,model,serial_number,notes").eq("id", job.equipment_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("chillbros_job_parts").select("quantity,part:chillbros_parts_catalog(name,part_number)").eq("job_id", jobId),
  ]);

  const partsUsed = (partRows ?? []).map((row) => {
    const part = Array.isArray(row.part) ? row.part[0] : row.part;
    return { quantity: row.quantity, name: part?.name ?? null, partNumber: part?.part_number ?? null };
  });

  const { error } = await supabase.from("chillbros_knowledge_cases").upsert({
    job_id: job.id,
    invoice_id: invoiceId,
    equipment_id: job.equipment_id,
    customer_id: job.customer_id,
    technician_id: technicianId ?? job.assigned_tech_id,
    source_type: "completed_job",
    equipment_type: equipment?.equipment_type ?? null,
    manufacturer: equipment?.manufacturer ?? null,
    model: equipment?.model ?? null,
    serial_number: equipment?.serial_number ?? null,
    asset_tag: equipment?.asset_tag ?? null,
    complaint: job.scope ?? null,
    work_performed: job.work_performed ?? null,
    parts_used: partsUsed,
    technical_notes: equipment?.notes ?? null,
    verification_grade: "field",
    knowledge_status: "verified",
    updated_at: new Date().toISOString(),
  }, { onConflict: "job_id" });

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
