"use server";

import { revalidatePath } from "next/cache";

import { sendTechnicianAssignmentEmail } from "@/lib/chillbros/assignment-notifications";
import { JOB_ACTIVE_STATUSES } from "@/lib/chillbros/types";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

// `warning` is set when the call saved but something after it (the technician
// email) did not go through, so the office knows to follow up.
type Result = { ok: true; jobId: string; warning?: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseWindow(value: string | null | undefined) {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})\s+([0-2]\d:[0-5]\d)-([0-2]\d:[0-5]\d)\s+CT$/);
  return match ? { date: match[1], start: match[2], end: match[3] } : null;
}

const clean = (value: string | null | undefined, max: number) => {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
};

export async function createEquipmentLinkedJobAction(input: {
  customerId: string;
  equipmentId?: string | null;
  assignedTechId?: string | null;
  location?: string;
  scope?: string;
  scheduledWindow?: string;
  /** Random id made once per open form, so a double tap saves one call. */
  submissionId?: string;
}): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) return { ok: false, error: "Office or manager access required." };
  if (!input.customerId) return { ok: false, error: "Choose a customer." };

  const supabase = createServiceRoleClient();
  const { data: customer } = await supabase.from("chillbros_customers").select("id,name,address").eq("id", input.customerId).maybeSingle();
  if (!customer) return { ok: false, error: "Customer record not found." };

  if (input.equipmentId) {
    const { data: equipment } = await supabase.from("chillbros_equipment").select("id,customer_id,asset_tag,equipment_type,manufacturer,model").eq("id", input.equipmentId).maybeSingle();
    if (!equipment) return { ok: false, error: "Equipment record not found." };
    if (equipment.customer_id !== input.customerId) return { ok: false, error: "That equipment belongs to a different customer." };
  }

  if (input.assignedTechId) {
    const { data: tech } = await supabase.from("chillbros_profiles").select("id").eq("id", input.assignedTechId).in("role", ["technician", "manager"]).eq("status", "active").maybeSingle();
    if (!tech) return { ok: false, error: "Choose an active field-service account." };
  }

  const submissionId = input.submissionId && UUID.test(input.submissionId) ? input.submissionId : undefined;
  if (submissionId) {
    const { data: existing } = await supabase.from("chillbros_jobs").select("id,customer_id").eq("id", submissionId).maybeSingle();
    if (existing) return existing.customer_id === input.customerId ? { ok: true, jobId: existing.id } : { ok: false, error: "Refresh the page and try again." };
  }

  // Same double-booking guard the schedule screen used: a technician cannot
  // hold two open calls that overlap on the same day.
  const slot = parseWindow(input.scheduledWindow);
  if (input.assignedTechId && slot) {
    const { data: booked, error: bookedError } = await supabase
      .from("chillbros_jobs")
      .select("id,scheduled_window")
      .eq("assigned_tech_id", input.assignedTechId)
      .is("archived_at", null)
      .in("status", JOB_ACTIVE_STATUSES)
      .not("scheduled_window", "is", null);
    if (bookedError) return { ok: false, error: `Could not check technician availability: ${bookedError.message}` };
    for (const row of booked ?? []) {
      const other = parseWindow(row.scheduled_window);
      if (other && other.date === slot.date && slot.start < other.end && slot.end > other.start) {
        return { ok: false, error: `That technician is already scheduled ${other.start}-${other.end} on ${slot.date}. Pick another time or technician.` };
      }
    }
  }

  const location = clean(input.location, 500) ?? clean(customer.address, 500);
  const { data: job, error } = await supabase.from("chillbros_jobs").insert({
    ...(submissionId ? { id: submissionId } : {}),
    customer_id: input.customerId,
    equipment_id: input.equipmentId || null,
    assigned_tech_id: input.assignedTechId || null,
    status: input.scheduledWindow ? "scheduled" : "needs_scheduling",
    location,
    scope: clean(input.scope, 4000),
    scheduled_window: clean(input.scheduledWindow, 200),
  }).select("id").single();
  if (error || !job) {
    if (error?.code === "23505" && submissionId) return { ok: true, jobId: submissionId };
    return { ok: false, error: error?.message ?? "Could not create service call." };
  }

  const equipmentMessage = input.equipmentId ? " Equipment was linked at intake." : " No equipment was selected at intake.";
  await supabase.from("chillbros_workflow_events").insert({
    job_id: job.id,
    actor_id: profile.id,
    stage: input.equipmentId ? "job_created_equipment_linked" : "job_created",
    message: `Service call created.${equipmentMessage}`,
  });
  await supabase.from("chillbros_customer_service_history").insert({
    customer_id: input.customerId,
    note: `Service call created${input.scheduledWindow ? ` • ${String(input.scheduledWindow).slice(0, 150)}` : " • needs scheduling"}${input.equipmentId ? " • equipment linked" : ""}`,
  });

  // Email the assigned technician, like the schedule screen did.
  let warning: string | undefined;
  if (input.assignedTechId) {
    let sent: { sent: boolean; status: string; recipient: string | null };
    try { sent = await sendTechnicianAssignmentEmail(job.id, "assigned"); }
    catch (cause) { sent = { sent: false, status: cause instanceof Error ? cause.message : "Technician notification failed.", recipient: null }; }
    await supabase.from("chillbros_workflow_events").insert({
      job_id: job.id,
      actor_id: profile.id,
      stage: sent.sent ? "technician_assignment_email_sent" : "technician_assignment_email_failed",
      message: `New call technician notification ${sent.status}${sent.recipient ? ` to ${sent.recipient}` : ""}.`,
    });
    if (!sent.sent && sent.status !== "deduplicated") warning = `Technician email not sent: ${sent.status}`;
  }

  for (const path of ["/dispatch", "/schedule", "/work", "/work-orders", "/office", "/technician", "/equipment", `/customers/${input.customerId}`, `/jobs/${job.id}`, "/"]) revalidatePath(path);
  return warning ? { ok: true, jobId: job.id, warning } : { ok: true, jobId: job.id };
}
