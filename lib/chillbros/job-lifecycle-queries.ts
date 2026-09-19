import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { getInvoiceV2ByJobId } from "./invoice-v2";
import { getJob } from "./queries";

export type LifecycleStage =
  | "service_call"
  | "diagnosis"
  | "awaiting_approval"
  | "approved_needs_action"
  | "return_scheduled"
  | "work_in_progress"
  | "invoice_ready"
  | "payment_due"
  | "paid";

export type JobLifecycleEvent = { id: string; stage: string; message: string; createdAt: string };

export async function getJobLifecycle(jobId: string) {
  const [job, invoice] = await Promise.all([getJob(jobId), getInvoiceV2ByJobId(jobId)]);
  if (!job) return null;

  const supabase = createServiceRoleClient();
  const { data: rows } = await supabase
    .from("chillbros_workflow_events")
    .select("id,stage,message,created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(60);
  const events: JobLifecycleEvent[] = (rows ?? []).map((row) => ({ id: row.id, stage: row.stage, message: row.message, createdAt: row.created_at }));
  const latestStage = events[0]?.stage ?? job.status;

  let stage: LifecycleStage;
  if (invoice?.paymentStatus === "paid") stage = "paid";
  else if (invoice?.issuedAt) stage = "payment_due";
  else if (invoice?.status === "approved" && latestStage === "return_scheduled") stage = "return_scheduled";
  else if (invoice?.status === "approved" && (latestStage === "approved_work_now" || job.status === "in_progress")) stage = "work_in_progress";
  else if (invoice?.status === "approved") stage = "approved_needs_action";
  else if (invoice?.status === "awaiting_approval") stage = "awaiting_approval";
  else if (job.status === "in_progress") stage = "diagnosis";
  else if (job.status === "completed") stage = "invoice_ready";
  else stage = "service_call";

  const nextAction = stage === "service_call" ? "Start or complete the diagnostic visit."
    : stage === "diagnosis" ? "Finish diagnosis and build the estimate."
    : stage === "awaiting_approval" ? "Customer needs to review and approve the estimate."
    : stage === "approved_needs_action" ? "Choose Work Now or schedule the return visit."
    : stage === "return_scheduled" ? "Complete the approved work on the scheduled return visit."
    : stage === "work_in_progress" ? "Complete the approved work, then issue the final invoice."
    : stage === "invoice_ready" ? "Create or issue the final invoice."
    : stage === "payment_due" ? "Invoice is issued. Customer payment is the next step."
    : "Paid and complete.";

  return { job, invoice, events, stage, nextAction };
}

export const LIFECYCLE_STEPS = [
  { key: "service", label: "Service Call" },
  { key: "diagnosis", label: "Diagnose" },
  { key: "estimate", label: "Estimate" },
  { key: "approval", label: "Approval" },
  { key: "work", label: "Work / Return" },
  { key: "invoice", label: "Invoice" },
  { key: "payment", label: "Payment" },
] as const;

export function completedLifecycleStepCount(stage: LifecycleStage) {
  if (stage === "service_call") return 0;
  if (stage === "diagnosis") return 1;
  if (stage === "awaiting_approval") return 3;
  if (stage === "approved_needs_action" || stage === "return_scheduled" || stage === "work_in_progress") return 4;
  if (stage === "invoice_ready") return 5;
  if (stage === "payment_due") return 6;
  return 7;
}
