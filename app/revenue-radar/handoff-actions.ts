"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const uuid = (raw: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);

async function handoffUser() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "technician"].includes(profile.role)) throw new Error("Technician handoff access required.");
  return profile;
}

async function managerUser() {
  const profile = await handoffUser();
  if (profile.role !== "manager") throw new Error("Manager access required.");
  return profile;
}

async function history(client: ReturnType<typeof createServiceRoleClient>, args: {
  leadId: string;
  handoffId: string;
  action: string;
  actorId: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
}) {
  const { error } = await client.from("chillbros_revenue_history").insert({
    lead_id: args.leadId,
    entity_type: "handoff",
    entity_id: args.handoffId,
    action: args.action,
    actor_id: args.actorId,
    actor_type: "user",
    previous_value: args.previousValue ?? null,
    new_value: args.newValue ?? null,
    reason: args.reason ?? null,
  });
  if (error) throw new Error(`Audit history failed: ${error.message}`);
}

async function closeReviewTasks(client: ReturnType<typeof createServiceRoleClient>, handoffId: string, note: string) {
  const { error } = await client.from("chillbros_revenue_tasks").update({
    status: "completed",
    completion_notes: note,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("handoff_id", handoffId).eq("task_type", "technician_handoff_review").in("status", ["open", "in_progress", "overdue"]);
  if (error) throw new Error(error.message);
}

async function createSalesFollowUp(client: ReturnType<typeof createServiceRoleClient>, args: { leadId: string; ownerId: string; description: string }) {
  const { data: existing, error: lookupError } = await client.from("chillbros_revenue_tasks")
    .select("id")
    .eq("lead_id", args.leadId)
    .eq("task_type", "follow_up")
    .eq("assigned_user", args.ownerId)
    .in("status", ["open", "in_progress", "overdue"])
    .limit(1)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  const dueAt = new Date(Date.now() + 60 * 60000).toISOString();
  if (existing) {
    const { error } = await client.from("chillbros_revenue_tasks").update({ description: args.description, due_at: dueAt, status: "open", updated_at: new Date().toISOString() }).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await client.from("chillbros_revenue_tasks").insert({
    lead_id: args.leadId,
    assigned_user: args.ownerId,
    created_by: args.ownerId,
    task_type: "follow_up",
    description: args.description,
    due_at: dueAt,
    status: "open",
  });
  if (error) throw new Error(error.message);
}

export async function assignRevenueHandoff(form: FormData) {
  const profile = await managerUser();
  const handoffId = value(form, "handoff_id");
  const technicianId = value(form, "assigned_technician");
  if (!uuid(handoffId) || !uuid(technicianId)) throw new Error("Select a valid handoff and technician.");
  const client = createServiceRoleClient();
  const [{ data: handoff, error: handoffError }, { data: technician, error: techError }] = await Promise.all([
    client.from("chillbros_revenue_handoffs").select("id,lead_id,status,assigned_technician").eq("id", handoffId).maybeSingle(),
    client.from("chillbros_profiles").select("id,full_name,role,status").eq("id", technicianId).maybeSingle(),
  ]);
  if (handoffError || !handoff) throw new Error(handoffError?.message || "Handoff not found.");
  if (techError || !technician || technician.role !== "technician" || technician.status !== "active") throw new Error("Select an active technician.");
  if (["completed", "declined"].includes(handoff.status)) throw new Error("Closed handoffs cannot be reassigned without correction.");

  const { error } = await client.from("chillbros_revenue_handoffs").update({ assigned_technician: technicianId, updated_at: new Date().toISOString() }).eq("id", handoffId);
  if (error) throw new Error(error.message);
  await history(client, {
    leadId: handoff.lead_id,
    handoffId,
    action: "assigned",
    actorId: profile.id,
    previousValue: { assignedTechnician: handoff.assigned_technician },
    newValue: { assignedTechnician: technicianId, technicianName: technician.full_name },
  });
  revalidatePath("/revenue-radar/handoffs");
  revalidatePath(`/revenue-radar/${handoff.lead_id}`);
}

export async function acceptRevenueHandoff(form: FormData) {
  const profile = await handoffUser();
  const handoffId = value(form, "handoff_id");
  if (!uuid(handoffId)) throw new Error("Invalid handoff.");
  const client = createServiceRoleClient();
  const { data: handoff, error } = await client.from("chillbros_revenue_handoffs").select("id,lead_id,status,assigned_technician").eq("id", handoffId).maybeSingle();
  if (error || !handoff) throw new Error(error?.message || "Handoff not found.");
  if (profile.role === "technician" && handoff.assigned_technician !== profile.id) throw new Error("This handoff is not assigned to you.");
  if (handoff.status !== "received") throw new Error("Only received handoffs can be accepted.");
  if (!handoff.assigned_technician) throw new Error("Assign a technician before accepting the handoff.");

  const acceptedAt = new Date().toISOString();
  const { error: updateError } = await client.from("chillbros_revenue_handoffs").update({ status: "accepted", accepted_at: acceptedAt, updated_at: acceptedAt }).eq("id", handoffId);
  if (updateError) throw new Error(updateError.message);
  await closeReviewTasks(client, handoffId, "Technician handoff accepted.");
  await history(client, { leadId: handoff.lead_id, handoffId, action: "accepted", actorId: profile.id, previousValue: { status: handoff.status }, newValue: { status: "accepted", acceptedAt } });
  revalidatePath("/revenue-radar/handoffs");
  revalidatePath(`/revenue-radar/${handoff.lead_id}`);
}

export async function declineRevenueHandoff(form: FormData) {
  const profile = await handoffUser();
  const handoffId = value(form, "handoff_id");
  const reason = value(form, "decline_reason").slice(0, 1500);
  if (!uuid(handoffId) || !reason) throw new Error("Declining a handoff requires a reason.");
  const client = createServiceRoleClient();
  const { data: handoff, error } = await client.from("chillbros_revenue_handoffs").select("id,lead_id,status,assigned_technician").eq("id", handoffId).maybeSingle();
  if (error || !handoff) throw new Error(error?.message || "Handoff not found.");
  if (profile.role === "technician" && handoff.assigned_technician !== profile.id) throw new Error("This handoff is not assigned to you.");
  if (handoff.status !== "received") throw new Error("Only received handoffs can be declined.");

  const now = new Date().toISOString();
  const { error: updateError } = await client.from("chillbros_revenue_handoffs").update({ status: "declined", decline_reason: reason, updated_at: now }).eq("id", handoffId);
  if (updateError) throw new Error(updateError.message);
  const { data: lead, error: leadError } = await client.from("chillbros_revenue_prospects").select("assigned_salesperson").eq("id", handoff.lead_id).maybeSingle();
  if (leadError) throw new Error(leadError.message);
  const ownerId = lead?.assigned_salesperson || profile.id;
  const { error: statusError } = await client.from("chillbros_revenue_prospects").update({ sales_status: "qualified", status_reason: `Technician handoff declined: ${reason}` }).eq("id", handoff.lead_id);
  if (statusError) throw new Error(statusError.message);
  await closeReviewTasks(client, handoffId, `Handoff declined: ${reason}`);
  await createSalesFollowUp(client, { leadId: handoff.lead_id, ownerId, description: `Review declined technician handoff: ${reason}` });
  await history(client, { leadId: handoff.lead_id, handoffId, action: "declined", actorId: profile.id, previousValue: { status: handoff.status }, newValue: { status: "declined", leadStatus: "qualified" }, reason });
  revalidatePath("/revenue-radar/handoffs");
  revalidatePath(`/revenue-radar/${handoff.lead_id}`);
  revalidatePath("/revenue-radar");
}

export async function scheduleRevenueHandoff(form: FormData) {
  const profile = await handoffUser();
  const handoffId = value(form, "handoff_id");
  const scheduledRaw = value(form, "scheduled_at");
  const location = value(form, "scheduled_location").slice(0, 500);
  const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
  if (!uuid(handoffId) || !scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now() || !location) throw new Error("Scheduling requires a future date/time and location or remote method.");
  const client = createServiceRoleClient();
  const { data: handoff, error } = await client.from("chillbros_revenue_handoffs").select("id,lead_id,status,assigned_technician,best_contact,customer_contact").eq("id", handoffId).maybeSingle();
  if (error || !handoff) throw new Error(error?.message || "Handoff not found.");
  if (profile.role === "technician" && handoff.assigned_technician !== profile.id) throw new Error("This handoff is not assigned to you.");
  if (!handoff.assigned_technician) throw new Error("Assign a technician before scheduling.");
  if (!["accepted", "scheduled"].includes(handoff.status)) throw new Error("Accept the handoff before scheduling technical follow-up.");

  const iso = scheduledAt.toISOString();
  const { error: updateError } = await client.from("chillbros_revenue_handoffs").update({ status: "scheduled", scheduled_at: iso, scheduled_location: location, updated_at: new Date().toISOString() }).eq("id", handoffId);
  if (updateError) throw new Error(updateError.message);
  const { error: leadError } = await client.from("chillbros_revenue_prospects").update({ sales_status: "appointment_set", status_reason: `Technical follow-up scheduled ${iso} at ${location}` }).eq("id", handoff.lead_id);
  if (leadError) throw new Error(leadError.message);

  const { data: existingTask, error: taskLookupError } = await client.from("chillbros_revenue_tasks").select("id").eq("handoff_id", handoffId).eq("task_type", "technical_appointment").in("status", ["open", "in_progress", "overdue"]).limit(1).maybeSingle();
  if (taskLookupError) throw new Error(taskLookupError.message);
  if (existingTask) {
    const { error: taskError } = await client.from("chillbros_revenue_tasks").update({ assigned_user: handoff.assigned_technician, due_at: iso, description: `Technical follow-up at ${location}`, status: "open", updated_at: new Date().toISOString() }).eq("id", existingTask.id);
    if (taskError) throw new Error(taskError.message);
  } else {
    const { error: taskError } = await client.from("chillbros_revenue_tasks").insert({ lead_id: handoff.lead_id, handoff_id: handoffId, assigned_user: handoff.assigned_technician, created_by: profile.id, task_type: "technical_appointment", description: `Technical follow-up at ${location}`, due_at: iso, status: "open" });
    if (taskError) throw new Error(taskError.message);
  }
  await history(client, { leadId: handoff.lead_id, handoffId, action: handoff.status === "scheduled" ? "rescheduled" : "scheduled", actorId: profile.id, previousValue: { status: handoff.status }, newValue: { status: "scheduled", scheduledAt: iso, location, leadStatus: "appointment_set", bestContact: handoff.best_contact || handoff.customer_contact } });
  revalidatePath("/revenue-radar/handoffs");
  revalidatePath(`/revenue-radar/${handoff.lead_id}`);
  revalidatePath("/revenue-radar");
}

export async function completeRevenueHandoff(form: FormData) {
  const profile = await handoffUser();
  const handoffId = value(form, "handoff_id");
  const technicalNotes = value(form, "technical_notes").slice(0, 4000);
  const resolution = value(form, "resolution").slice(0, 2000);
  if (!uuid(handoffId) || !technicalNotes || !resolution) throw new Error("Completion requires technical notes and a resolution or unresolved condition.");
  const client = createServiceRoleClient();
  const { data: handoff, error } = await client.from("chillbros_revenue_handoffs").select("id,lead_id,status,assigned_technician").eq("id", handoffId).maybeSingle();
  if (error || !handoff) throw new Error(error?.message || "Handoff not found.");
  if (profile.role === "technician" && handoff.assigned_technician !== profile.id) throw new Error("This handoff is not assigned to you.");
  if (!["accepted", "scheduled"].includes(handoff.status)) throw new Error("Only accepted or scheduled handoffs can be completed.");

  const completedAt = new Date().toISOString();
  const { error: updateError } = await client.from("chillbros_revenue_handoffs").update({ status: "completed", technical_notes: technicalNotes, resolution, completed_at: completedAt, updated_at: completedAt }).eq("id", handoffId);
  if (updateError) throw new Error(updateError.message);
  const { data: lead, error: leadLookupError } = await client.from("chillbros_revenue_prospects").select("assigned_salesperson").eq("id", handoff.lead_id).maybeSingle();
  if (leadLookupError) throw new Error(leadLookupError.message);
  const { error: leadError } = await client.from("chillbros_revenue_prospects").update({ sales_status: "qualified", status_reason: "Technical handoff completed; sales next step required", last_activity_at: completedAt }).eq("id", handoff.lead_id);
  if (leadError) throw new Error(leadError.message);
  const { error: taskError } = await client.from("chillbros_revenue_tasks").update({ status: "completed", completion_notes: `Technical handoff completed: ${resolution}`, completed_at: completedAt, updated_at: completedAt }).eq("handoff_id", handoffId).in("status", ["open", "in_progress", "overdue"]);
  if (taskError) throw new Error(taskError.message);
  const ownerId = lead?.assigned_salesperson || profile.id;
  await createSalesFollowUp(client, { leadId: handoff.lead_id, ownerId, description: `Review technician findings and choose next sales step: ${resolution}` });
  await history(client, { leadId: handoff.lead_id, handoffId, action: "completed", actorId: profile.id, previousValue: { status: handoff.status }, newValue: { status: "completed", leadStatus: "qualified", resolution, completedAt } });
  revalidatePath("/revenue-radar/handoffs");
  revalidatePath(`/revenue-radar/${handoff.lead_id}`);
  revalidatePath("/revenue-radar");
}
