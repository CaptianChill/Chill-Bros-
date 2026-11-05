"use server";

import { revalidatePath } from "next/cache";

import { CALL_RESULTS } from "@/lib/chillbros/leadbiz/buyer-scripts";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

const VALID = new Set(CALL_RESULTS.map(([v]) => v));

// Saves one call result on the Lead Buyers list (shared with the New Openings owner site).
export async function saveBuyerCall(license: string, name: string, status: string, note?: string) {
  const profile = await getCurrentStaffProfile();
  if (profile?.role !== "manager" || !license || !VALID.has(status)) return false;
  const db = createServiceRoleClient();
  const { error } = status
    ? await db.from("chillbros_leadbiz_calls").upsert({ license: license.slice(0, 40), business_name: name.slice(0, 200), status, ...(note !== undefined ? { note: note.slice(0, 500) || null } : {}), updated_at: new Date().toISOString() }, { onConflict: "license" })
    : await db.from("chillbros_leadbiz_calls").delete().eq("license", license);
  if (!error) revalidatePath("/revenue-radar/buyers");
  return !error;
}
