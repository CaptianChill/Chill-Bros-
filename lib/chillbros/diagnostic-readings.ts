"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

const allowedCategories = new Set(["hvac","refrigeration","cooking","electrical","general"]);

export async function saveDiagnosticReadingAction(formData: FormData) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager","technician"].includes(profile.role)) return;
  const jobId = String(formData.get("jobId") ?? "").trim();
  const category = String(formData.get("category") ?? "general").trim();
  if (!jobId || !allowedCategories.has(category)) return;
  const supabase = createServiceRoleClient();
  const { data: job } = await supabase.from("chillbros_jobs").select("id,equipment_id,assigned_tech_id").eq("id",jobId).maybeSingle();
  if (!job || (profile.role === "technician" && job.assigned_tech_id !== profile.id)) return;
  const readings: Record<string,string> = {};
  for (const key of ["suction","discharge","superheat","subcooling","boxTemp","ambientTemp","deltaT","voltage","compressorAmps","fanAmps","gasPressure","flameSignal"]) {
    const value = String(formData.get(key) ?? "").trim(); if (value) readings[key] = value.slice(0,80);
  }
  const notes = String(formData.get("notes") ?? "").trim().slice(0,2000) || null;
  if (!Object.keys(readings).length && !notes) return;
  await supabase.from("chillbros_diagnostic_readings").insert({ job_id:jobId, equipment_id:job.equipment_id, technician_id:profile.id, category, readings, notes });
  await supabase.from("chillbros_workflow_events").insert({ job_id:jobId, actor_id:profile.id, stage:"diagnostic_readings_saved", message:`Structured ${category} diagnostic readings saved${job.equipment_id ? " to the linked equipment history" : ""}.` });
  revalidatePath(`/jobs/${jobId}`); revalidatePath("/technician"); if (job.equipment_id) revalidatePath(`/equipment/${job.equipment_id}`);
}

export async function getDiagnosticReadings(jobId: string) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_diagnostic_readings").select("id,category,readings,notes,created_at,tech:chillbros_profiles(full_name)").eq("job_id",jobId).order("created_at",{ascending:false}).limit(100);
  return (data ?? []).map((row:any)=>({ id:row.id, category:row.category, readings:row.readings as Record<string,string>, notes:row.notes as string|null, createdAt:row.created_at as string, technicianName:(Array.isArray(row.tech)?row.tech[0]:row.tech)?.full_name ?? "Unknown technician" }));
}