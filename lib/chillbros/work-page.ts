// Pure rules for the technician Work Page (/jobs/[id]). No server or client
// imports so server actions, components and tests all share one definition.
import { JOB_ACTIVE_STATUSES, type JobStatus } from "./types";

// ---------------------------------------------------------------------------
// Status changes a field user (assigned technician or manager) may make.

/** Always allowed from any active status: the original three field steps. */
const LEGACY_FIELD_STATUSES: JobStatus[] = ["en_route", "arrived", "work_complete"];

/** Extra field steps, keyed by the job's current status. */
const FIELD_TRANSITIONS: Partial<Record<JobStatus, JobStatus[]>> = {
  arrived: ["diagnosing", "parts_required", "repairing"],
  in_progress: ["diagnosing", "parts_required", "repairing"],
  diagnosing: ["parts_required", "return_visit_needed", "repairing"],
  awaiting_approval: ["parts_required", "return_visit_needed"],
  approved: ["repairing", "parts_required", "return_visit_needed"],
  parts_required: ["repairing", "return_visit_needed"],
  return_visit_needed: ["repairing", "parts_required"],
  repairing: ["parts_required", "return_visit_needed"],
  work_complete: ["repairing", "ready_to_invoice"],
};

export function fieldNextStatuses(current: JobStatus): JobStatus[] {
  if (!JOB_ACTIVE_STATUSES.includes(current)) return [];
  if (current === "ready_to_invoice" || current === "invoice_sent") return [];
  const next = new Set<JobStatus>([...LEGACY_FIELD_STATUSES, ...(FIELD_TRANSITIONS[current] ?? [])]);
  next.delete(current);
  return Array.from(next);
}

export function canFieldSetStatus(current: JobStatus, next: JobStatus) {
  return current === next || fieldNextStatuses(current).includes(next);
}

// ---------------------------------------------------------------------------
// Statuses in which the assigned technician may still edit the job in the
// field (parts, photos, receipts). Mirrors FIELD_PART_STATUSES in job-parts.ts.
export const FIELD_EDIT_STATUSES: JobStatus[] = [
  "scheduled", "in_progress", "dispatched", "en_route", "arrived", "diagnosing", "awaiting_approval",
  "approved", "parts_required", "return_visit_needed", "repairing", "work_complete",
];

// ---------------------------------------------------------------------------
// Sticky bottom action bar.
export type ActionBarMode = "travel" | "diagnosis" | "parts" | "approved" | "repair" | "invoice" | "closed";

export function actionBarMode(status: JobStatus, hasInvoice: boolean): ActionBarMode {
  if (!JOB_ACTIVE_STATUSES.includes(status)) return "closed";
  if (["new", "needs_scheduling", "scheduled", "dispatched", "en_route"].includes(status)) return "travel";
  if (["arrived", "in_progress", "diagnosing"].includes(status)) return "diagnosis";
  if (["parts_required", "return_visit_needed", "awaiting_approval"].includes(status)) return "parts";
  if (status === "approved") return "approved";
  if (status === "repairing") return "repair";
  if (status === "work_complete") return hasInvoice ? "invoice" : "repair";
  if (status === "ready_to_invoice" || status === "invoice_sent") return "invoice";
  return "closed";
}

// ---------------------------------------------------------------------------
// On-site customer signature: only once the repair is under way or done,
// never during diagnosis or while waiting on parts/approval.
export const SIGNATURE_STATUSES: JobStatus[] = ["repairing", "work_complete", "ready_to_invoice", "invoice_sent"];
export const canCaptureSignature = (status: JobStatus) => SIGNATURE_STATUSES.includes(status);

// ---------------------------------------------------------------------------
// Technician reschedule (owner-approved mapping, 2026-09-25).
export const RESCHEDULE_REASONS = {
  customer_not_ready: "Customer not ready",
  no_access: "No access",
  out_of_time: "Out of time",
  waiting_on_parts: "Waiting on parts",
  other: "Other",
} as const;
export type RescheduleReason = keyof typeof RESCHEDULE_REASONS;
export const isRescheduleReason = (value: string): value is RescheduleReason => Object.hasOwn(RESCHEDULE_REASONS, value);

/**
 * Status a job moves to when its assigned technician reschedules it, or null
 * when a technician may not reschedule from this status.
 */
export function technicianRescheduleStatus(current: JobStatus, reason: RescheduleReason): JobStatus | null {
  const parts = reason === "waiting_on_parts";
  switch (current) {
    case "new":
    case "needs_scheduling":
    case "scheduled":
    case "dispatched":
    case "en_route":
      return "scheduled";
    case "arrived":
    case "in_progress":
    case "diagnosing":
      return parts ? "parts_required" : "scheduled";
    case "awaiting_approval":
    case "approved":
    case "parts_required":
    case "return_visit_needed":
      return current;
    case "repairing":
      return parts ? "parts_required" : "return_visit_needed";
    default:
      // work_complete, ready_to_invoice, invoice_sent, paid, completed, cancelled
      return null;
  }
}

// ---------------------------------------------------------------------------
// Part field status (chillbros_job_parts.field_status). NULL shows as On truck.
export const PART_FIELD_STATUSES = { on_truck: "On truck", need_to_order: "Need to order", ordered: "Ordered" } as const;
export type PartFieldStatus = keyof typeof PART_FIELD_STATUSES;
export const isPartFieldStatus = (value: string): value is PartFieldStatus => Object.hasOwn(PART_FIELD_STATUSES, value);
export const partFieldStatusLabel = (value: string | null | undefined) =>
  value && isPartFieldStatus(value) ? PART_FIELD_STATUSES[value] : PART_FIELD_STATUSES.on_truck;

// ---------------------------------------------------------------------------
// Repair / return report (stored as a `repair_report` workflow event).
export const REPAIR_OUTCOMES = {
  completed: "Repair completed",
  returning_with_parts: "Returning with parts",
  temporary_repair: "Temporary repair",
} as const;
export type RepairOutcome = keyof typeof REPAIR_OUTCOMES;
export const isRepairOutcome = (value: string): value is RepairOutcome => Object.hasOwn(REPAIR_OUTCOMES, value);

// ---------------------------------------------------------------------------
// Technician landing lists.
export type LandingBucket = "today" | "active" | "saved";

/** Which landing section a technician's open job belongs in. */
export function landingBucket(job: { status: JobStatus; scheduledDate: string | null }, today: string): LandingBucket {
  if (job.scheduledDate === today) return "today";
  if (["en_route", "arrived", "in_progress", "diagnosing", "repairing"].includes(job.status)) return "active";
  if (["parts_required", "return_visit_needed", "awaiting_approval", "approved", "work_complete", "ready_to_invoice"].includes(job.status)) return "saved";
  return "active";
}
