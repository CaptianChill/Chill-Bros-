"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const uuid = (raw: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);

async function taskUser() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) throw new Error("Sales task access required.");
  return profile;
}

async function loadOwnedTask(taskId: string) {
  const profile = await taskUser();
  if (!uuid(taskId)) throw new Error("Invalid task.");
  const client = createServiceRoleClient();
  const { data: task, error } = await client.from("chillbros_revenue_tasks").select("id,lead_id,assigned_user,status,due_at,description,task_type").eq("id", taskId).maybeSingle();
  if (error || !task) throw new Error(error?.message || "Task not found.");
  if (profile.role !== "manager" && task.assigned_user !== profile.id) throw new Error("This task is not assigned to you.");
  return { profile, client, task };
}

async function audit(client: ReturnType<typeof createServiceRoleClient>, args: { leadId: string; taskId: string; actorId: string; action: string; previousValue: unknown; newValue: unknown; reason?: string | null }) {
  const { error } = await client.from("chillbros_revenue_history").insert({
    lead_id: args.leadId,
    entity_type: "task",
    entity_id: args.taskId,
    action: args.action,
    actor_id: args.actorId,
    actor_type: "user",
    previous_value: args.previousValue,
    new_value: args.newValue,
    reason: args.reason ?? null,
  });
  if (error) throw new Error(`Audit history failed: ${error.message}`);
}

export async function completeRevenueTask(form: FormData) {
  const taskId = value(form, "task_id");
  const notes = value(form, "completion_notes").slice(0, 2000);
  if (!notes) throw new Error("Task completion requires notes.");
  const { profile, client, task } = await loadOwnedTask(taskId);
  if (["completed", "canceled"].includes(task.status)) throw new Error("This task is already closed.");
  const completedAt = new Date().toISOString();
  const { error } = await client.from("chillbros_revenue_tasks").update({ status: "completed", completion_notes: notes, completed_at: completedAt, updated_at: completedAt }).eq("id", taskId);
  if (error) throw new Error(error.message);
  await audit(client, { leadId: task.lead_id, taskId, actorId: profile.id, action: "completed", previousValue: { status: task.status }, newValue: { status: "completed", completedAt, notes } });
  revalidatePath("/revenue-radar/tasks");
  revalidatePath(`/revenue-radar/${task.lead_id}`);
  revalidatePath("/revenue-radar");
}

export async function rescheduleRevenueTask(form: FormData) {
  const taskId = value(form, "task_id");
  const dueRaw = value(form, "due_at");
  const dueAt = dueRaw ? new Date(dueRaw) : null;
  if (!dueAt || Number.isNaN(dueAt.getTime()) || dueAt.getTime() <= Date.now()) throw new Error("Rescheduling requires a future due date and time.");
  const { profile, client, task } = await loadOwnedTask(taskId);
  if (["completed", "canceled"].includes(task.status)) throw new Error("Closed tasks cannot be rescheduled without manager correction.");
  const iso = dueAt.toISOString();
  const { error } = await client.from("chillbros_revenue_tasks").update({ due_at: iso, status: "open", updated_at: new Date().toISOString() }).eq("id", taskId);
  if (error) throw new Error(error.message);
  await audit(client, { leadId: task.lead_id, taskId, actorId: profile.id, action: "rescheduled", previousValue: { status: task.status, dueAt: task.due_at }, newValue: { status: "open", dueAt: iso } });
  revalidatePath("/revenue-radar/tasks");
  revalidatePath(`/revenue-radar/${task.lead_id}`);
  revalidatePath("/revenue-radar");
}

export async function cancelRevenueTask(form: FormData) {
  const taskId = value(form, "task_id");
  const reason = value(form, "cancellation_reason").slice(0, 1500);
  if (!reason) throw new Error("Canceling a task requires a reason.");
  const { profile, client, task } = await loadOwnedTask(taskId);
  if (["completed", "canceled"].includes(task.status)) throw new Error("This task is already closed.");
  const { error } = await client.from("chillbros_revenue_tasks").update({ status: "canceled", cancellation_reason: reason, updated_at: new Date().toISOString() }).eq("id", taskId);
  if (error) throw new Error(error.message);
  await audit(client, { leadId: task.lead_id, taskId, actorId: profile.id, action: "canceled", previousValue: { status: task.status }, newValue: { status: "canceled" }, reason });
  revalidatePath("/revenue-radar/tasks");
  revalidatePath(`/revenue-radar/${task.lead_id}`);
  revalidatePath("/revenue-radar");
}
