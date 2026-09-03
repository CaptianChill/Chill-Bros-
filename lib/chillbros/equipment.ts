"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

type Result = { ok: true } | { ok: false; error: string };

async function requireManager() {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (profile.role !== "manager") return { ok: false as const, error: "Manager access required." };
  return { ok: true as const };
}

export type EquipmentInput = { id?: string; customerId: string; equipmentType: string; manufacturer?: string; model?: string; serialNumber?: string; refrigerant?: string; notes?: string };

function clean(value: string | undefined, max: number) { const v = String(value ?? "").trim(); return v ? v.slice(0, max) : null; }

export async function createEquipmentAction(input: EquipmentInput): Promise<Result> {
  const guard = await requireManager(); if (!guard.ok) return guard;
  if (!input.customerId || !input.equipmentType.trim()) return { ok: false, error: "Customer and equipment type are required." };
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("chillbros_equipment").insert({ customer_id: input.customerId, equipment_type: input.equipmentType.trim().slice(0, 120), manufacturer: clean(input.manufacturer, 160), model: clean(input.model, 160), serial_number: clean(input.serialNumber, 160), refrigerant: clean(input.refrigerant, 80), notes: clean(input.notes, 4000) });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipment"); revalidatePath("/crm"); revalidatePath("/technician");
  return { ok: true };
}

export async function updateEquipmentAction(input: EquipmentInput & { id: string }): Promise<Result> {
  const guard = await requireManager(); if (!guard.ok) return guard;
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("chillbros_equipment").update({ customer_id: input.customerId, equipment_type: input.equipmentType.trim().slice(0, 120), manufacturer: clean(input.manufacturer, 160), model: clean(input.model, 160), serial_number: clean(input.serialNumber, 160), refrigerant: clean(input.refrigerant, 80), notes: clean(input.notes, 4000), updated_at: new Date().toISOString() }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipment"); revalidatePath("/technician");
  return { ok: true };
}

export async function deleteEquipmentAction(id: string): Promise<Result> {
  const guard = await requireManager(); if (!guard.ok) return guard;
  const supabase = createServiceRoleClient();
  const { count } = await supabase.from("chillbros_jobs").select("id", { count: "exact", head: true }).eq("equipment_id", id);
  if ((count ?? 0) > 0) return { ok: false, error: "This equipment is linked to job history and cannot be deleted." };
  const { error } = await supabase.from("chillbros_equipment").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipment");
  return { ok: true };
}
