"use server";

import { revalidatePath } from "next/cache";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

type Result = { ok: true } | { ok: false; error: string };

async function requireOfficeOrManager() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) return { ok: false as const, error: "Office or manager access required." };
  return { ok: true as const, profile };
}

function refresh(jobId: string) {
  for (const path of ["/dispatch", "/technician", "/equipment", "/customers", `/jobs/${jobId}`, "/"]) revalidatePath(path);
}

export async function linkEquipmentToJobAction(input: { jobId: string; equipmentId: string | null }): Promise<Result> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  if (!input.jobId) return { ok: false, error: "Choose a job." };

  const supabase = createServiceRoleClient();
  const { data: job } = await supabase.from("chillbros_jobs").select("id,customer_id,equipment_id,status").eq("id", input.jobId).maybeSingle();
  if (!job) return { ok: false, error: "Job not found." };
  if (["paid", "cancelled"].includes(job.status)) return { ok: false, error: "Closed jobs cannot be reassigned to different equipment." };

  let equipmentLabel = "No equipment selected";
  if (input.equipmentId) {
    const { data: equipment } = await supabase
      .from("chillbros_equipment")
      .select("id,customer_id,asset_tag,equipment_type,manufacturer,model")
      .eq("id", input.equipmentId)
      .maybeSingle();
    if (!equipment) return { ok: false, error: "Equipment record not found." };
    if (equipment.customer_id !== job.customer_id) return { ok: false, error: "That equipment belongs to a different customer." };
    equipmentLabel = [equipment.asset_tag, equipment.manufacturer, equipment.model, equipment.equipment_type].filter(Boolean).join(" • ");
  }

  const { data: updated, error } = await supabase
    .from("chillbros_jobs")
    .update({ equipment_id: input.equipmentId || null, updated_at: new Date().toISOString() })
    .eq("id", input.jobId)
    .select("id")
    .maybeSingle();
  if (error || !updated) return { ok: false, error: error?.message ?? "Could not link equipment." };

  await supabase.from("chillbros_workflow_events").insert({
    job_id: input.jobId,
    actor_id: guard.profile.id,
    stage: input.equipmentId ? "equipment_linked" : "equipment_unlinked",
    message: input.equipmentId ? `Equipment linked to permanent job record: ${equipmentLabel}.` : "Equipment link removed from job record.",
  });

  refresh(input.jobId);
  return { ok: true };
}

export async function scheduleJobReturnVisitAction(input: {
  jobId: string;
  date: string;
  start: string;
  end: string;
  technicianId?: string | null;
  reason?: string;
}): Promise<Result> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  if (!input.jobId) return { ok: false, error: "Choose a job." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: "Choose a valid return date." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.end) || input.start >= input.end) return { ok: false, error: "Choose a valid return-visit time window." };

  const supabase = createServiceRoleClient();
  const { data: job } = await supabase.from("chillbros_jobs").select("id,customer_id,status,assigned_tech_id").eq("id", input.jobId).maybeSingle();
  if (!job) return { ok: false, error: "Job not found." };
  if (["paid", "completed", "cancelled"].includes(job.status)) return { ok: false, error: "Closed jobs cannot be scheduled for another visit." };

  if (input.technicianId) {
    const { data: tech } = await supabase.from("chillbros_profiles").select("id").eq("id", input.technicianId).in("role", ["technician", "manager"]).eq("status", "active").maybeSingle();
    if (!tech) return { ok: false, error: "Choose an active technician." };
  }

  const scheduledWindow = `${input.date} ${input.start}-${input.end} CT`;
  const update: Record<string, string | null> = {
    status: "scheduled",
    scheduled_window: scheduledWindow,
    updated_at: new Date().toISOString(),
  };
  if (input.technicianId) update.assigned_tech_id = input.technicianId;

  const { data: updated, error } = await supabase.from("chillbros_jobs").update(update).eq("id", input.jobId).select("id").maybeSingle();
  if (error || !updated) return { ok: false, error: error?.message ?? "Could not schedule return visit." };

  const reason = String(input.reason ?? "").trim().slice(0, 500);
  await supabase.from("chillbros_workflow_events").insert({
    job_id: input.jobId,
    actor_id: guard.profile.id,
    stage: "return_scheduled",
    message: `Return visit scheduled for ${scheduledWindow} on the same job${reason ? ` • ${reason}` : ""}.`,
  });
  await supabase.from("chillbros_customer_service_history").insert({
    customer_id: job.customer_id,
    note: `Return visit scheduled • ${scheduledWindow}${reason ? ` • ${reason}` : ""}`,
  });

  refresh(input.jobId);
  return { ok: true };
}
