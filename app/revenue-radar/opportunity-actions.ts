"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const uuid = (raw: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);

async function managerUser() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") throw new Error("Manager access required.");
  return profile;
}

async function audit(client: ReturnType<typeof createServiceRoleClient>, args: { leadId: string; actorId: string; action: string; previousValue: unknown; newValue: unknown; reason: string }) {
  const { error } = await client.from("chillbros_revenue_history").insert({
    lead_id: args.leadId,
    entity_type: "lead",
    entity_id: args.leadId,
    action: args.action,
    actor_id: args.actorId,
    actor_type: "user",
    previous_value: args.previousValue,
    new_value: args.newValue,
    reason: args.reason,
  });
  if (error) throw new Error(`Audit history failed: ${error.message}`);
}

export async function closeRevenueOpportunity(form: FormData) {
  const profile = await managerUser();
  const leadId = value(form, "lead_id");
  const outcome = value(form, "outcome");
  const reason = value(form, "reason").slice(0, 2000);
  const revenueRaw = value(form, "actual_revenue");
  if (!uuid(leadId) || !["won", "lost"].includes(outcome) || !reason) throw new Error("Won/Lost closeout requires a valid lead and reason.");

  let actualRevenue: number | null = null;
  if (revenueRaw) {
    actualRevenue = Number(revenueRaw);
    if (!Number.isFinite(actualRevenue) || actualRevenue < 0) throw new Error("Actual revenue must be zero or greater.");
  }
  if (outcome === "won" && actualRevenue == null) throw new Error("Won opportunities require actual revenue so Revenue Radar can attribute results.");

  const client = createServiceRoleClient();
  const { data: lead, error: leadError } = await client
    .from("chillbros_revenue_prospects")
    .select("id,sales_status,status,actual_revenue,do_not_contact")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError || !lead) throw new Error(leadError?.message || "Lead not found.");
  if (["won", "lost"].includes(lead.sales_status)) throw new Error("This opportunity is already closed. Use manager correction to reopen it first.");

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    sales_status: outcome,
    status: outcome,
    status_reason: reason,
    last_activity_at: now,
    follow_up_at: null,
    updated_by: profile.id,
    updated_at: now,
  };
  if (outcome === "won") update.actual_revenue = actualRevenue;

  const { error } = await client.from("chillbros_revenue_prospects").update(update).eq("id", leadId);
  if (error) throw new Error(error.message);

  // Closing the sales opportunity ends sales follow-up/appointment tasks only.
  // Technical handoff review remains operational work and must not disappear just because the deal closed.
  const { error: taskError } = await client.from("chillbros_revenue_tasks").update({
    status: "canceled",
    cancellation_reason: `Opportunity closed ${outcome}: ${reason}`.slice(0, 1500),
    updated_at: now,
  }).eq("lead_id", leadId).in("task_type", ["follow_up", "appointment"]).in("status", ["open", "in_progress", "overdue"]);
  if (taskError) throw new Error(taskError.message);

  await audit(client, {
    leadId,
    actorId: profile.id,
    action: `closed_${outcome}`,
    previousValue: { salesStatus: lead.sales_status, legacyStatus: lead.status, actualRevenue: lead.actual_revenue, doNotContact: lead.do_not_contact },
    newValue: { salesStatus: outcome, legacyStatus: outcome, actualRevenue: outcome === "won" ? actualRevenue : lead.actual_revenue },
    reason,
  });

  revalidatePath("/revenue-radar/opportunities");
  revalidatePath(`/revenue-radar/${leadId}`);
  revalidatePath("/revenue-radar");
}

export async function reopenRevenueOpportunity(form: FormData) {
  const profile = await managerUser();
  const leadId = value(form, "lead_id");
  const reason = value(form, "reason").slice(0, 2000);
  if (!uuid(leadId) || !reason) throw new Error("Manager correction requires a reason.");

  const client = createServiceRoleClient();
  const { data: lead, error: leadError } = await client
    .from("chillbros_revenue_prospects")
    .select("id,sales_status,status,actual_revenue,do_not_contact")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError || !lead) throw new Error(leadError?.message || "Lead not found.");
  if (!["won", "lost"].includes(lead.sales_status)) throw new Error("Only closed opportunities can be reopened here.");
  if (lead.do_not_contact) throw new Error("Do Not Contact must be reviewed and cleared before reopening sales activity.");

  const now = new Date().toISOString();
  const { error } = await client.from("chillbros_revenue_prospects").update({
    sales_status: "qualified",
    status: "contacted",
    status_reason: `Reopened by manager: ${reason}`,
    updated_by: profile.id,
    updated_at: now,
  }).eq("id", leadId);
  if (error) throw new Error(error.message);

  await audit(client, {
    leadId,
    actorId: profile.id,
    action: "reopened",
    previousValue: { salesStatus: lead.sales_status, legacyStatus: lead.status, actualRevenue: lead.actual_revenue },
    newValue: { salesStatus: "qualified", legacyStatus: "contacted" },
    reason,
  });

  revalidatePath("/revenue-radar/opportunities");
  revalidatePath(`/revenue-radar/${leadId}`);
  revalidatePath("/revenue-radar");
}
