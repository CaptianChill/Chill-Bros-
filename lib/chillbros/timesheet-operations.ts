"use server";

import { revalidatePath } from "next/cache";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function clockInResilientAction(location: string): Promise<Result<{ timesheetId: string; clockInAt: string; location: string | null }>> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role !== "technician") return { ok: false, error: "Technician access required." };

  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase
    .from("chillbros_timesheets")
    .select("id, clock_in_at, location")
    .eq("technician_id", profile.id)
    .is("clock_out_at", null)
    .order("clock_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, data: { timesheetId: existing.id, clockInAt: existing.clock_in_at, location: existing.location } };

  const { data: activeJob } = await supabase
    .from("chillbros_jobs")
    .select("id, location")
    .eq("assigned_tech_id", profile.id)
    .in("status", ["scheduled", "in_progress"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const cleanLocation = String(location ?? "").trim() || activeJob?.location || null;
  const { data, error } = await supabase
    .from("chillbros_timesheets")
    .insert({ technician_id: profile.id, job_id: activeJob?.id ?? null, location: cleanLocation, clock_in_at: new Date().toISOString() })
    .select("id, clock_in_at, location")
    .single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "You already have an open clock session. Refresh the page." : error?.message ?? "Could not clock in." };

  await supabase.from("chillbros_profiles").update({ last_clock_event: `Clocked in ${new Date(data.clock_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` }).eq("id", profile.id);
  revalidatePath("/timesheet");
  return { ok: true, data: { timesheetId: data.id, clockInAt: data.clock_in_at, location: data.location } };
}

export async function clockOutResilientAction(timesheetId: string, laborHours: number, driveHours: number): Promise<Result<{ clockOutAt: string }>> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role !== "technician") return { ok: false, error: "Technician access required." };
  const labor = Number(laborHours); const drive = Number(driveHours);
  if (!Number.isFinite(labor) || labor < 0 || labor > 24 || !Number.isFinite(drive) || drive < 0 || drive > 24) return { ok: false, error: "Labor and drive hours must be between 0 and 24." };

  const supabase = createServiceRoleClient();
  const clockOutAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("chillbros_timesheets")
    .update({ clock_out_at: clockOutAt, labor_hours: labor, drive_hours: drive })
    .eq("id", timesheetId)
    .eq("technician_id", profile.id)
    .is("clock_out_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "This clock session is already closed or unavailable." };

  await supabase.from("chillbros_profiles").update({ last_clock_event: `Clocked out ${new Date(clockOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` }).eq("id", profile.id);
  revalidatePath("/timesheet");
  return { ok: true, data: { clockOutAt } };
}
