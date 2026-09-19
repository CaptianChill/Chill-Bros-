"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { BATTLE_CARD_PROMPT_VERSION, buildSafeBattleCard } from "@/lib/chillbros/revenue-sales";

const ACTIVE_TASK_STATUSES = ["open", "in_progress", "overdue"] as const;
const ACTIVITY_TYPES = ["call_attempt", "connected_call", "voicemail", "email_message", "inbound_inquiry", "meeting", "other"] as const;
const OUTCOMES = ["no_answer", "voicemail", "gatekeeper", "connected", "need_identified", "technical_issue", "appointment_scheduled", "proposal_requested", "not_interested"] as const;

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const uuid = (raw: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
const optional = (raw: string, max = 2000) => raw.slice(0, max) || null;

async function salesUser() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) throw new Error("Sales access required.");
  return profile;
}

async function managerUser() {
  const profile = await salesUser();
  if (profile.role !== "manager") throw new Error("Manager access required.");
  return profile;
}

function requireAssignedLead(profile: { id: string; role: string }, lead: { assigned_salesperson?: string | null }) {
  if (profile.role === "office" && lead.assigned_salesperson !== profile.id) {
    throw new Error("This lead is not assigned to you.");
  }
}

async function appendHistory(client: ReturnType<typeof createServiceRoleClient>, entry: {
  leadId: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  actorId: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
}) {
  const { error } = await client.from("chillbros_revenue_history").insert({
    lead_id: entry.leadId,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    action: entry.action,
    actor_id: entry.actorId,
    actor_type: "user",
    previous_value: entry.previousValue ?? null,
    new_value: entry.newValue ?? null,
    reason: entry.reason ?? null,
  });
  if (error) throw new Error(`Audit history failed: ${error.message}`);
}

async function upsertOpenTask(client: ReturnType<typeof createServiceRoleClient>, args: {
  leadId: string;
  activityId: string;
  ownerId: string;
  taskType: string;
  dueAt: string;
  description: string;
}) {
  const { data: existing, error: lookupError } = await client
    .from("chillbros_revenue_tasks")
    .select("id,due_at,description,status")
    .eq("lead_id", args.leadId)
    .eq("task_type", args.taskType)
    .eq("assigned_user", args.ownerId)
    .in("status", [...ACTIVE_TASK_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  if (existing) {
    const { error } = await client.from("chillbros_revenue_tasks").update({
      activity_id: args.activityId,
      due_at: args.dueAt,
      description: args.description,
      status: "open",
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { id: existing.id as string, updated: true, previous: existing };
  }

  const { data, error } = await client.from("chillbros_revenue_tasks").insert({
    lead_id: args.leadId,
    activity_id: args.activityId,
    assigned_user: args.ownerId,
    created_by: args.ownerId,
    task_type: args.taskType,
    description: args.description,
    due_at: args.dueAt,
    status: "open",
  }).select("id").single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, updated: false, previous: null };
}

function statusForOutcome(outcome: string, hasFollowUp: boolean) {
  if (["no_answer", "voicemail", "gatekeeper", "connected"].includes(outcome)) return "contacted";
  if (["need_identified", "technical_issue"].includes(outcome)) return "qualified";
  if (outcome === "appointment_scheduled") return "appointment_set";
  if (outcome === "proposal_requested") return "proposal_requested";
  if (outcome === "not_interested") return hasFollowUp ? "nurture" : "lost";
  return "contacted";
}

export async function generateSalesBattleCard(form: FormData) {
  const profile = await salesUser();
  const leadId = value(form, "lead_id");
  if (!uuid(leadId)) throw new Error("Invalid lead.");
  const client = createServiceRoleClient();
  const [{ data: lead, error }, { data: previousCard }] = await Promise.all([
    client.from("chillbros_revenue_prospects").select("*").eq("id", leadId).maybeSingle(),
    client.from("chillbros_revenue_battle_cards").select("id").eq("lead_id", leadId).eq("is_current", true).maybeSingle(),
  ]);
  if (error || !lead) throw new Error(error?.message || "Lead not found.");
  requireAssignedLead(profile, lead);

  const card = buildSafeBattleCard({
    businessName: lead.business_name,
    city: lead.city,
    businessType: lead.category,
    score: Number(lead.score),
    serviceLine: lead.service_line,
    signalSummary: lead.signal_summary,
    signalVerified: Boolean(lead.signal_verified),
    sourceUrl: lead.source_url,
    observedAt: lead.signal_observed_at,
    businessAddress: lead.business_address,
    contactName: lead.contact_name,
    contactRole: lead.contact_role,
    contactPhone: lead.contact_phone,
    contactEmail: lead.contact_email,
  });

  const { data: created, error: createError } = await client.from("chillbros_revenue_battle_cards").insert({
    lead_id: leadId,
    content: card,
    prompt_version: BATTLE_CARD_PROMPT_VERSION,
    generation_trigger: "user_request",
    generated_by: profile.id,
    is_current: false,
  }).select("id").single();
  if (createError) throw new Error(createError.message);

  const now = new Date().toISOString();
  if (previousCard) {
    const { error: retireError } = await client.from("chillbros_revenue_battle_cards").update({ is_current: false, superseded_at: now }).eq("id", previousCard.id);
    if (retireError) throw new Error(retireError.message);
  }
  const { error: promoteError } = await client.from("chillbros_revenue_battle_cards").update({ is_current: true }).eq("id", created.id);
  if (promoteError) {
    if (previousCard) await client.from("chillbros_revenue_battle_cards").update({ is_current: true, superseded_at: null }).eq("id", previousCard.id);
    throw new Error(promoteError.message);
  }

  const shouldReady = Boolean(lead.assigned_salesperson) && ["new", "ready_to_call"].includes(lead.sales_status ?? "new");
  if (shouldReady) {
    const { error: readyError } = await client.from("chillbros_revenue_prospects").update({ sales_status: "ready_to_call" }).eq("id", leadId);
    if (readyError) throw new Error(readyError.message);
  }

  await appendHistory(client, {
    leadId,
    entityType: "battle_card",
    entityId: created.id,
    action: "generated",
    actorId: profile.id,
    newValue: { promptVersion: BATTLE_CARD_PROMPT_VERSION, salesStatus: shouldReady ? "ready_to_call" : lead.sales_status ?? "new" },
  });
  revalidatePath(`/revenue-radar/${leadId}`);
  revalidatePath("/revenue-radar");
}

export async function assignRevenueSalesperson(form: FormData) {
  const profile = await managerUser();
  const leadId = value(form, "lead_id");
  const assigneeId = value(form, "assigned_salesperson");
  if (!uuid(leadId) || !uuid(assigneeId)) throw new Error("Select a valid lead and salesperson.");
  const client = createServiceRoleClient();
  const [{ data: lead, error: leadError }, { data: assignee, error: staffError }] = await Promise.all([
    client.from("chillbros_revenue_prospects").select("id,assigned_salesperson,sales_status").eq("id", leadId).maybeSingle(),
    client.from("chillbros_profiles").select("id,full_name,role,status").eq("id", assigneeId).maybeSingle(),
  ]);
  if (leadError || !lead) throw new Error(leadError?.message || "Lead not found.");
  if (staffError || !assignee || assignee.status !== "active" || !["manager", "office"].includes(assignee.role)) throw new Error("Salesperson must be active office or manager staff.");

  const { count: battleCount, error: battleError } = await client.from("chillbros_revenue_battle_cards").select("id", { count: "exact", head: true }).eq("lead_id", leadId).eq("is_current", true);
  if (battleError) throw new Error(battleError.message);
  const nextStatus = battleCount ? "ready_to_call" : lead.sales_status ?? "new";
  const { error } = await client.from("chillbros_revenue_prospects").update({ assigned_salesperson: assigneeId, sales_status: nextStatus }).eq("id", leadId);
  if (error) throw new Error(error.message);

  await appendHistory(client, {
    leadId,
    entityType: "lead",
    entityId: leadId,
    action: "assigned",
    actorId: profile.id,
    previousValue: { assignedSalesperson: lead.assigned_salesperson, salesStatus: lead.sales_status },
    newValue: { assignedSalesperson: assigneeId, assignedName: assignee.full_name, salesStatus: nextStatus },
  });
  revalidatePath(`/revenue-radar/${leadId}`);
  revalidatePath("/revenue-radar");
}

export async function logRevenueActivity(form: FormData) {
  const profile = await salesUser();
  const leadId = value(form, "lead_id");
  const activityType = value(form, "activity_type");
  const outcome = value(form, "call_outcome");
  if (!uuid(leadId) || !ACTIVITY_TYPES.includes(activityType as typeof ACTIVITY_TYPES[number]) || !OUTCOMES.includes(outcome as typeof OUTCOMES[number])) throw new Error("Complete the activity type and outcome.");

  const nowMs = Date.now();
  const followUpRaw = value(form, "follow_up_at");
  const followUpAt = followUpRaw ? new Date(followUpRaw) : null;
  if (followUpAt && (Number.isNaN(followUpAt.getTime()) || followUpAt.getTime() <= nowMs)) throw new Error("Follow-up must be a future date and time.");

  const customerStatement = optional(value(form, "customer_statement"), 3000);
  const needIdentified = optional(value(form, "need_identified"), 2000);
  const nextStep = optional(value(form, "next_step"), 1500);
  const notes = optional(value(form, "notes"), 3000);
  if (["connected_call", "inbound_inquiry", "meeting"].includes(activityType) && !customerStatement) throw new Error("Record the customer's statement for a connected interaction.");
  if (outcome === "not_interested" && !followUpAt && !notes) throw new Error("Lost opportunities require a reason in Internal notes.");
  if (outcome === "proposal_requested" && !customerStatement && !needIdentified && !notes) throw new Error("Proposal Requested requires a recorded customer request, scope, or reason.");

  let appointmentAt: Date | null = null;
  let appointmentLocation: string | null = null;
  let appointmentType: string | null = null;
  if (outcome === "appointment_scheduled") {
    const raw = value(form, "appointment_at");
    appointmentAt = raw ? new Date(raw) : null;
    appointmentLocation = optional(value(form, "appointment_location"), 500);
    appointmentType = optional(value(form, "appointment_type"), 200);
    if (!appointmentAt || Number.isNaN(appointmentAt.getTime()) || appointmentAt.getTime() <= nowMs || !appointmentLocation || !appointmentType) {
      throw new Error("Appointment Set requires a future date/time, location or remote method, and appointment type.");
    }
  }

  const client = createServiceRoleClient();
  const { data: lead, error: leadError } = await client.from("chillbros_revenue_prospects").select("id,do_not_contact,sales_status,assigned_salesperson").eq("id", leadId).maybeSingle();
  if (leadError || !lead) throw new Error(leadError?.message || "Lead not found.");
  requireAssignedLead(profile, lead);
  if (lead.do_not_contact) throw new Error("This lead is Do Not Contact. Manager review is required before outreach.");

  const { data: activity, error: activityError } = await client.from("chillbros_revenue_activities").insert({
    lead_id: leadId,
    salesperson_id: profile.id,
    activity_type: activityType,
    call_outcome: outcome,
    contacted_person: optional(value(form, "contacted_person"), 200),
    contacted_role: optional(value(form, "contacted_role"), 200),
    customer_statement: customerStatement,
    need_identified: needIdentified,
    equipment_mentioned: optional(value(form, "equipment_mentioned"), 1000),
    current_vendor: optional(value(form, "current_vendor"), 500),
    urgency: optional(value(form, "urgency"), 100),
    next_step: nextStep,
    follow_up_at: followUpAt?.toISOString() ?? null,
    notes,
    appointment_at: appointmentAt?.toISOString() ?? null,
    appointment_location: appointmentLocation,
    appointment_type: appointmentType,
    appointment_confirmed: Boolean(appointmentAt),
  }).select("id").single();
  if (activityError) throw new Error(activityError.message);

  const nextStatus = statusForOutcome(outcome, Boolean(followUpAt));
  const now = new Date().toISOString();
  const { error: leadUpdateError } = await client.from("chillbros_revenue_prospects").update({
    sales_status: nextStatus,
    last_activity_at: now,
    follow_up_at: followUpAt?.toISOString() ?? null,
    status_reason: outcome === "not_interested" ? notes : null,
  }).eq("id", leadId);
  if (leadUpdateError) throw new Error(leadUpdateError.message);

  const taskOwner = lead.assigned_salesperson || profile.id;
  if (followUpAt) {
    const description = nextStep || "Follow up with lead";
    const task = await upsertOpenTask(client, { leadId, activityId: activity.id, ownerId: taskOwner, taskType: "follow_up", dueAt: followUpAt.toISOString(), description });
    await appendHistory(client, {
      leadId,
      entityType: "task",
      entityId: task.id,
      action: task.updated ? "rescheduled" : "created",
      actorId: profile.id,
      previousValue: task.previous,
      newValue: { taskType: "follow_up", dueAt: followUpAt.toISOString(), description },
    });
  }
  if (appointmentAt && appointmentLocation && appointmentType) {
    const description = `${appointmentType}: ${appointmentLocation}`;
    const task = await upsertOpenTask(client, { leadId, activityId: activity.id, ownerId: taskOwner, taskType: "appointment", dueAt: appointmentAt.toISOString(), description });
    await appendHistory(client, {
      leadId,
      entityType: "task",
      entityId: task.id,
      action: task.updated ? "rescheduled" : "created",
      actorId: profile.id,
      previousValue: task.previous,
      newValue: { taskType: "appointment", dueAt: appointmentAt.toISOString(), location: appointmentLocation, appointmentType },
    });
  }

  await appendHistory(client, {
    leadId,
    entityType: "activity",
    entityId: activity.id,
    action: "created",
    actorId: profile.id,
    previousValue: { salesStatus: lead.sales_status },
    newValue: { salesStatus: nextStatus, outcome, customerReported: Boolean(customerStatement), appointmentConfirmed: Boolean(appointmentAt) },
  });
  revalidatePath(`/revenue-radar/${leadId}`);
  revalidatePath("/revenue-radar");
}

export async function createRevenueTechnicianHandoff(form: FormData) {
  const profile = await salesUser();
  const leadId = value(form, "lead_id");
  const problem = value(form, "customer_reported_problem").slice(0, 3000);
  const urgency = value(form, "urgency").slice(0, 100);
  if (!uuid(leadId) || !problem || !urgency) throw new Error("Customer-reported problem and urgency are required.");
  const client = createServiceRoleClient();
  const [{ data: lead, error: leadError }, { data: manager }] = await Promise.all([
    client.from("chillbros_revenue_prospects").select("id,do_not_contact,sales_status,assigned_salesperson").eq("id", leadId).maybeSingle(),
    client.from("chillbros_profiles").select("id").eq("role", "manager").eq("status", "active").limit(1).maybeSingle(),
  ]);
  if (leadError || !lead) throw new Error(leadError?.message || "Lead not found.");
  requireAssignedLead(profile, lead);
  if (lead.do_not_contact && form.get("permission_to_follow_up") !== "on") throw new Error("Do Not Contact lead requires explicit customer permission for technical follow-up.");
  const taskOwner = manager?.id || (profile.role === "manager" ? profile.id : null);
  if (!taskOwner) throw new Error("No active manager is available to own the technician handoff review.");

  const activityId = value(form, "activity_id");
  if (activityId && !uuid(activityId)) throw new Error("Invalid originating activity.");
  const { data: handoff, error } = await client.from("chillbros_revenue_handoffs").insert({
    lead_id: leadId,
    activity_id: activityId || null,
    salesperson_id: profile.id,
    customer_contact: optional(value(form, "customer_contact"), 500),
    equipment_type: optional(value(form, "equipment_type"), 500),
    customer_reported_problem: problem,
    problem_started_at: optional(value(form, "problem_started_at"), 500),
    equipment_status: optional(value(form, "equipment_status"), 500),
    business_impact: optional(value(form, "business_impact"), 1500),
    urgency,
    site_access: optional(value(form, "site_access"), 1000),
    best_contact: optional(value(form, "best_contact"), 500),
    permission_to_follow_up: form.get("permission_to_follow_up") === "on",
    status: "received",
  }).select("id").single();
  if (error) throw new Error(error.message);

  const dueAt = new Date(Date.now() + (urgency === "emergency" ? 15 : urgency === "urgent" ? 60 : 240) * 60000).toISOString();
  const { data: task, error: taskError } = await client.from("chillbros_revenue_tasks").insert({
    lead_id: leadId,
    handoff_id: handoff.id,
    assigned_user: taskOwner,
    created_by: profile.id,
    task_type: "technician_handoff_review",
    description: `Review customer-reported technical need: ${problem.slice(0, 240)}`,
    due_at: dueAt,
    status: "open",
  }).select("id").single();
  if (taskError) throw new Error(taskError.message);

  const { error: leadUpdateError } = await client.from("chillbros_revenue_prospects").update({ sales_status: "technician_needed", last_activity_at: new Date().toISOString() }).eq("id", leadId);
  if (leadUpdateError) throw new Error(leadUpdateError.message);
  await appendHistory(client, {
    leadId,
    entityType: "handoff",
    entityId: handoff.id,
    action: "received",
    actorId: profile.id,
    previousValue: { salesStatus: lead.sales_status },
    newValue: { salesStatus: "technician_needed", urgency, customerReportedProblem: problem, reviewTaskId: task.id },
  });
  revalidatePath(`/revenue-radar/${leadId}`);
  revalidatePath("/revenue-radar");
}

export async function markRevenueDoNotContact(form: FormData) {
  const profile = await salesUser();
  const leadId = value(form, "lead_id");
  const reason = value(form, "reason").slice(0, 1500);
  if (!uuid(leadId) || !reason) throw new Error("Do Not Contact requires a reason.");
  const client = createServiceRoleClient();
  const { data: lead, error: leadError } = await client.from("chillbros_revenue_prospects").select("id,do_not_contact,sales_status,assigned_salesperson").eq("id", leadId).maybeSingle();
  if (leadError || !lead) throw new Error(leadError?.message || "Lead not found.");
  requireAssignedLead(profile, lead);
  const { error } = await client.from("chillbros_revenue_prospects").update({ do_not_contact: true, do_not_contact_reason: reason, sales_status: "do_not_contact", status_reason: reason }).eq("id", leadId);
  if (error) throw new Error(error.message);
  const { error: cancelError } = await client.from("chillbros_revenue_tasks").update({ status: "canceled", cancellation_reason: "Lead marked Do Not Contact", updated_at: new Date().toISOString() }).eq("lead_id", leadId).in("status", [...ACTIVE_TASK_STATUSES]);
  if (cancelError) throw new Error(cancelError.message);
  await appendHistory(client, {
    leadId,
    entityType: "lead",
    entityId: leadId,
    action: "do_not_contact",
    actorId: profile.id,
    previousValue: { doNotContact: lead.do_not_contact, salesStatus: lead.sales_status },
    newValue: { doNotContact: true, salesStatus: "do_not_contact" },
    reason,
  });
  revalidatePath(`/revenue-radar/${leadId}`);
  revalidatePath("/revenue-radar");
}
