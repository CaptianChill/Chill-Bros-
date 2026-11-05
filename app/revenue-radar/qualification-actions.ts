"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const checked = (form: FormData, key: string) => form.get(key) === "on";

async function manager() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager" || profile.status !== "active") throw new Error("Active manager access required.");
  return profile;
}

export async function recordOutreachReview(form: FormData) {
  const profile = await manager();
  const leadId = value(form, "lead_id");
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) throw new Error("Invalid lead.");
  const verdict = value(form, "verdict");
  const tier = value(form, "tier");
  if (!["approved", "blocked"].includes(verdict) || !["researched_prospect", "confirmed_need"].includes(tier)) throw new Error("Select a valid review outcome.");
  const snapshot = JSON.parse(value(form, "snapshot"));
  const client = createServiceRoleClient();
  const { error } = await client.from("chillbros_outreach_reviews").insert({
    prospect_id: leadId, sender_key: value(form, "sender_key"), reviewed_by: profile.id, verdict, tier, snapshot,
    contact_checked_at: value(form, "contact_checked_at") || null,
    source_checked_at: value(form, "source_checked_at") || null,
    need_confirmed_at: value(form, "need_confirmed_at") || null,
    contact_evidence: value(form, "contact_evidence").slice(0, 4000),
    source_rights_evidence: value(form, "source_rights_evidence").slice(0, 4000),
    need_evidence: value(form, "need_evidence").slice(0, 4000),
    location_verified: checked(form, "location_verified"), role_verified: checked(form, "role_verified"),
    outreach_permitted: checked(form, "outreach_permitted"), resale_permitted: checked(form, "resale_permitted"), sharing_permitted: checked(form, "sharing_permitted"),
  });
  if (error) throw new Error(`Review was not saved: ${error.message}`);
  revalidatePath(`/revenue-radar/${leadId}/qualification`);
}

/** Registers an isolated review scope only. Never creates credentials or enables a transport. */
export async function registerOutreachBuyer(form: FormData) {
  await manager();
  const name = value(form, "display_name").slice(0, 160);
  const key = value(form, "sender_key");
  if (!name || !/^buyer-[a-z0-9-]{3,70}$/.test(key)) throw new Error("Use a buyer name and a key such as buyer-example-company.");
  const { error } = await createServiceRoleClient().from("chillbros_outreach_senders").insert({ sender_key: key, display_name: name, kind: "buyer", approval_hold: true, transport_ready: false });
  if (error) throw new Error(`Buyer was not registered: ${error.message}`);
  revalidatePath("/revenue-radar", "layout");
}
