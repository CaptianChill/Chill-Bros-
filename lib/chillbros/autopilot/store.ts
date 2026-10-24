import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

import { normalizeContact } from "./links";
import { addDaysIso, centralNow, computeOpenSlots, type OpenSlot, type SlotSettings } from "./slots";
import type { PlaybookSettings } from "./playbook";

export type AutopilotSettings = SlotSettings & PlaybookSettings & {
  enabled: boolean;
  inbound_enabled: boolean;
  reactivation_enabled: boolean;
  cold_email_enabled: boolean;
  cold_daily_cap: number;
  reactivation_daily_cap: number;
  sends_per_open_slot: number;
  sender_postal_address: string;
};

const DEFAULTS: AutopilotSettings = {
  enabled: true,
  inbound_enabled: true,
  reactivation_enabled: true,
  cold_email_enabled: false,
  workday_start: "08:00",
  workday_end: "17:00",
  saturday_start: null,
  saturday_end: null,
  slot_minutes: 120,
  jobs_per_slot: null,
  booking_days_ahead: 7,
  min_lead_hours: 3,
  cold_daily_cap: 15,
  reactivation_daily_cap: 40,
  sends_per_open_slot: 10,
  residential_service_fee: null,
  commercial_service_fee: null,
  hood_cleaning_active: true,
  allow_reference_customers: false,
  sender_postal_address: "Chill Professionals LLC, 15226 Preston Pass, San Antonio, TX 78247",
};

type Client = ReturnType<typeof createServiceRoleClient>;

export async function getAutopilotSettings(client: Client = createServiceRoleClient()): Promise<AutopilotSettings> {
  const { data, error } = await client.from("chillbros_autopilot_settings").select("*").eq("id", 1).maybeSingle();
  if (error) console.error("[autopilot] settings read failed", error);
  return { ...DEFAULTS, ...(data ?? {}) } as AutopilotSettings;
}

export async function activeTechnicianCount(client: Client) {
  const { count } = await client.from("chillbros_profiles").select("id", { count: "exact", head: true }).eq("role", "technician").eq("status", "active");
  return Math.max(1, count ?? 1);
}

export async function loadOpenSlots(client: Client, settings: AutopilotSettings, now = new Date()): Promise<OpenSlot[]> {
  const today = centralNow(now).date;
  const last = addDaysIso(today, settings.booking_days_ahead + 1);
  // Canonical windows sort lexically by date, so a range on the text column finds the period's jobs.
  const [{ data: jobs, error }, techs] = await Promise.all([
    client.from("chillbros_jobs").select("scheduled_window,status,archived_at").gte("scheduled_window", today).lte("scheduled_window", `${last}~`).is("archived_at", null),
    activeTechnicianCount(client),
  ]);
  if (error) console.error("[autopilot] job read for slots failed", error);
  return computeOpenSlots(settings, jobs ?? [], techs, now);
}

export async function isSuppressed(client: Client, contact: string | null | undefined) {
  if (!contact) return false;
  const { data } = await client.from("chillbros_outreach_suppressions").select("contact").eq("contact", normalizeContact(contact)).maybeSingle();
  return Boolean(data);
}

export async function suppress(client: Client, contact: string, reason = "unsubscribed") {
  await client.from("chillbros_outreach_suppressions").upsert({ contact: normalizeContact(contact), reason }, { onConflict: "contact" });
}

export type OutreachLogRow = {
  lane: "inbound" | "reactivation" | "cold" | "booking" | "enrichment";
  step?: number;
  channel: "email" | "sms" | "none";
  recipient?: string | null;
  prospect_id?: string | null;
  customer_id?: string | null;
  inbound_lead_id?: string | null;
  subject?: string | null;
  body?: string | null;
  status: "sent" | "failed" | "skipped" | "configuration_required" | "dry_run";
  error?: string | null;
};

export async function logOutreach(client: Client, row: OutreachLogRow) {
  const { error } = await client.from("chillbros_outreach_log").insert({ step: 0, ...row, body: row.body?.slice(0, 8000) ?? null });
  if (error) console.error("[autopilot] outreach log insert failed", error);
}

/** Successful sends today (Central) for a lane, optionally filtered to cold kitchen/office via subject tag. */
export async function sentTodayCount(client: Client, lane: OutreachLogRow["lane"], now = new Date()) {
  const ct = centralNow(now);
  // Start of the Central day as an instant: now minus minutes elapsed today.
  const startOfDay = new Date(now.getTime() - ct.minutes * 60_000 - now.getUTCSeconds() * 1000).toISOString();
  const { count } = await client.from("chillbros_outreach_log").select("id", { count: "exact", head: true }).eq("lane", lane).eq("status", "sent").gte("created_at", startOfDay);
  return count ?? 0;
}
