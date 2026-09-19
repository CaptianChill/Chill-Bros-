"use server";

import { revalidatePath } from "next/cache";

import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";
import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";

type Result = { ok: true; jobId: string } | { ok: false; error: string };

const clean = (value: string | null | undefined, max: number) => {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
};

export async function createEquipmentLinkedJobAction(input: {
  customerId: string;
  equipmentId?: string | null;
  assignedTechId?: string | null;
  location?: string;
  scope?: string;
  scheduledWindow?: string;
}): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) return { ok: false, error: "Office or manager access required." };
  if (!input.customerId) return { ok: false, error: "Choose a customer." };

  const supabase = createServiceRoleClient();
  const { data: customer } = await supabase.from("chillbros_customers").select("id,name,address").eq("id", input.customerId).maybeSingle();
  if (!customer) return { ok: false, error: "Customer record not found." };

  if (input.equipmentId) {
    const { data: equipment } = await supabase.from("chillbros_equipment").select("id,customer_id,asset_tag,equipment_type,manufacturer,model").eq("id", input.equipmentId).maybeSingle();
    if (!equipment) return { ok: false, error: "Equipment record not found." };
    if (equipment.customer_id !== input.customerId) return { ok: false, error: "That equipment belongs to a different customer." };
  }

  if (input.assignedTechId) {
    const { data: tech } = await supabase.from("chillbros_profiles").select("id").eq("id", input.assignedTechId).in("role", ["technician", "manager"]).eq("status", "active").maybeSingle();
    if (!tech) return { ok: false, error: "Choose an active field-service account." };
  }

  const location = clean(input.location, 500) ?? clean(customer.address, 500);
  const { data: job, error } = await supabase.from("chillbros_jobs").insert({
    customer_id: input.customerId,
    equipment_id: input.equipmentId || null,
    assigned_tech_id: input.assignedTechId || null,
    status: input.scheduledWindow ? "scheduled" : "needs_scheduling",
    location,
    scope: clean(input.scope, 4000),
    scheduled_window: clean(input.scheduledWindow, 200),
  }).select("id").single();
  if (error || !job) return { ok: false, error: error?.message ?? "Could not create service call." };

  const equipmentMessage = input.equipmentId ? " Equipment was linked at intake." : " No equipment was selected at intake.";
  await supabase.from("chillbros_workflow_events").insert({
    job_id: job.id,
    actor_id: profile.id,
    stage: input.equipmentId ? "job_created_equipment_linked" : "job_created",
    message: `Service call created.${equipmentMessage}`,
  });
  await supabase.from("chillbros_customer_service_history").insert({
    customer_id: input.customerId,
    note: `Service call created${input.scheduledWindow ? ` • ${String(input.scheduledWindow).slice(0, 150)}` : " • needs scheduling"}${input.equipmentId ? " • equipment linked" : ""}`,
  });

  for (const path of ["/dispatch", "/technician", "/equipment", `/customers/${input.customerId}`, `/jobs/${job.id}`, "/"]) revalidatePath(path);
  return { ok: true, jobId: job.id };
}
