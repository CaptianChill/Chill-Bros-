"use server";

import { revalidatePath } from "next/cache";

import { getOwnerProfile } from "@/lib/chillbros/sent-invoice-history";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

const SWITCHES = ["enabled", "inbound_enabled", "reactivation_enabled", "cold_email_enabled", "reply_enabled", "hood_cleaning_active"] as const;
export type AutopilotSwitch = (typeof SWITCHES)[number];

/** Owner-only on/off switches for the autopilot lanes. */
export async function setAutopilotSwitchAction(key: AutopilotSwitch, value: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!(await getOwnerProfile())) return { ok: false, error: "Owner access required." };
  if (!SWITCHES.includes(key)) return { ok: false, error: "Unknown setting." };
  const { error } = await createServiceRoleClient().from("chillbros_autopilot_settings").update({ [key]: Boolean(value), updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { ok: false, error: "Could not save." };
  revalidatePath("/owner/autopilot");
  return { ok: true };
}

/** Owner-only daily caps. */
export async function setAutopilotCapsAction(input: { coldDailyCap: number; reactivationDailyCap: number }): Promise<{ ok: boolean; error?: string }> {
  if (!(await getOwnerProfile())) return { ok: false, error: "Owner access required." };
  const cold = Math.round(Number(input.coldDailyCap));
  const react = Math.round(Number(input.reactivationDailyCap));
  if (!(cold >= 0 && cold <= 500) || !(react >= 0 && react <= 500)) return { ok: false, error: "Caps must be 0 to 500." };
  const { error } = await createServiceRoleClient().from("chillbros_autopilot_settings").update({ cold_daily_cap: cold, reactivation_daily_cap: react, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { ok: false, error: "Could not save." };
  revalidatePath("/owner/autopilot");
  return { ok: true };
}
