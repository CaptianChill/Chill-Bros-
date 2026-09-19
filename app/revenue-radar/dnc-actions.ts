"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

const uuid = (raw: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const RESTORE_STATUSES = new Set(["qualified", "nurture"]);

export async function reverseRevenueDoNotContact(form: FormData) {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") throw new Error("Manager access required.");

  const leadId = value(form, "lead_id");
  const evidence = value(form, "evidence").slice(0, 3000);
  const restoreStatus = value(form, "restore_status");
  if (!uuid(leadId) || evidence.length < 10 || !RESTORE_STATUSES.has(restoreStatus)) {
    throw new Error("DNC reversal requires a valid lead, documented evidence, and a permitted restore status.");
  }

  const client = createServiceRoleClient();
  const { data: lead, error: leadError } = await client
    .from("chillbros_revenue_prospects")
    .select("id,business_name,do_not_contact,do_not_contact_reason,sales_status")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError || !lead) throw new Error(leadError?.message || "Lead not found.");
  if (!lead.do_not_contact && lead.sales_status !== "do_not_contact") throw new Error("This lead is not currently Do Not Contact.");

  const now = new Date().toISOString();
  const { error: updateError } = await client.from("chillbros_revenue_prospects").update({
    do_not_contact: false,
    do_not_contact_reason: null,
    sales_status: restoreStatus,
    status_reason: `DNC reversal evidence: ${evidence}`,
    updated_by: profile.id,
    updated_at: now,
  }).eq("id", leadId);
  if (updateError) throw new Error(updateError.message);

  const { error: historyError } = await client.from("chillbros_revenue_history").insert({
    lead_id: leadId,
    entity_type: "lead",
    entity_id: leadId,
    action: "do_not_contact_reversed",
    actor_id: profile.id,
    actor_type: "user",
    previous_value: {
      doNotContact: Boolean(lead.do_not_contact),
      reason: lead.do_not_contact_reason,
      salesStatus: lead.sales_status,
    },
    new_value: {
      doNotContact: false,
      salesStatus: restoreStatus,
    },
    reason: evidence,
  });
  if (historyError) throw new Error(`DNC reversal audit failed: ${historyError.message}`);

  revalidatePath("/revenue-radar");
  revalidatePath("/revenue-radar/dnc");
  revalidatePath(`/revenue-radar/${leadId}`);
  revalidatePath(`/revenue-radar/${leadId}/history`);
}
