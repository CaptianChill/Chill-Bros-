"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getCurrentStaffProfile, type StaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { JOB_ACTIVE_STATUSES, type JobStatus } from "./types";
import { canCaptureSignature, isRepairOutcome, REPAIR_OUTCOMES } from "./work-page";

type Result = { ok: true } | { ok: false; error: string };

const MEDIA_BUCKET = "chillbros-media";
const RECEIPT_TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["application/pdf", "pdf"]]);
const MAX_RECEIPT_BYTES = 3.5 * 1024 * 1024;
const MAX_SIGNATURE_BYTES = 400 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

type JobAccess = { ok: true; profile: StaffProfile; job: { id: string; status: JobStatus; customer_id: string } } | { ok: false; error: string };

/**
 * Manager always; office only when `allowOffice`; a technician only on a job
 * assigned to them. Closed jobs are read-only for everyone here.
 */
async function requireJobAccess(jobId: string, allowOffice: boolean): Promise<JobAccess> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Sign in to continue." };
  if (profile.role === "office" && !allowOffice) return { ok: false, error: "The assigned technician or a manager does this." };
  if (!["manager", "office", "technician"].includes(profile.role)) return { ok: false, error: "Staff access required." };
  if (!jobId) return { ok: false, error: "Job not found." };
  const supabase = createServiceRoleClient();
  let query = supabase.from("chillbros_jobs").select("id,status,customer_id").eq("id", jobId).is("archived_at", null);
  if (profile.role === "technician") query = query.eq("assigned_tech_id", profile.id);
  const { data: job } = await query.maybeSingle();
  if (!job) return { ok: false, error: profile.role === "technician" ? "This job is not assigned to you." : "Job not found." };
  if (!JOB_ACTIVE_STATUSES.includes(job.status as JobStatus)) return { ok: false, error: "This job is closed." };
  return { ok: true, profile, job: job as { id: string; status: JobStatus; customer_id: string } };
}

function refreshJob(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/technician");
}

// ---------------------------------------------------------------------------
// Internal receipts — never customer-facing.

export async function uploadJobReceiptAction(formData: FormData): Promise<Result> {
  const jobId = String(formData.get("jobId") ?? "").trim();
  const access = await requireJobAccess(jobId, true);
  if (!access.ok) return access;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Take or choose a receipt photo first." };
  if (file.size > MAX_RECEIPT_BYTES) return { ok: false, error: "Receipt file is too large (max 3.5MB)." };
  const extension = RECEIPT_TYPES.get(file.type);
  if (!extension) return { ok: false, error: "Upload a JPEG, PNG, WebP or PDF receipt." };

  const vendor = String(formData.get("vendor") ?? "").trim().slice(0, 200) || null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;
  const amountText = String(formData.get("amount") ?? "").trim().replace(/[$,]/g, "");
  const amount = amountText ? Number(amountText) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount >= 1_000_000)) return { ok: false, error: "Enter a valid amount." };

  const supabase = createServiceRoleClient();
  const path = `receipts/${jobId}/${Date.now()}-${randomBytes(4).toString("hex")}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { error } = await supabase.from("chillbros_job_receipts").insert({
    job_id: jobId,
    storage_path: path,
    vendor,
    amount: amount === null ? null : Math.round(amount * 100) / 100,
    note,
    created_by: access.profile.id,
  });
  if (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    return { ok: false, error: error.message };
  }
  refreshJob(jobId);
  return { ok: true };
}

/** Owner/office decision only; nothing customer-facing reads this flag yet. */
export async function setReceiptShowOnInvoiceAction(receiptId: string, show: boolean): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) return { ok: false, error: "Only the office or a manager can change this." };
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_job_receipts").update({ show_on_invoice: Boolean(show) }).eq("id", receiptId).select("job_id").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Receipt not found." };
  refreshJob(data.job_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// On-site customer signature (separate from the invoice/portal signature).

export async function captureJobSignatureAction(input: { jobId: string; signerName: string; signaturePng: string | null; customerUnavailable: boolean }): Promise<Result> {
  const access = await requireJobAccess(input.jobId, false);
  if (!access.ok) return access;
  if (!canCaptureSignature(access.job.status)) return { ok: false, error: "Customer sign-off opens once the repair is under way or done." };

  const unavailable = Boolean(input.customerUnavailable);
  const signerName = String(input.signerName ?? "").trim().slice(0, 200) || null;
  const supabase = createServiceRoleClient();
  let path: string | null = null;

  if (!unavailable) {
    if (!signerName || signerName.length < 2) return { ok: false, error: "Enter the customer's printed name." };
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(input.signaturePng ?? ""));
    if (!match) return { ok: false, error: "Have the customer sign in the box first." };
    const bytes = Buffer.from(match[1], "base64");
    if (bytes.length > MAX_SIGNATURE_BYTES || bytes.length < PNG_MAGIC.length || PNG_MAGIC.some((byte, i) => bytes[i] !== byte)) {
      return { ok: false, error: "That signature image couldn't be read. Clear it and sign again." };
    }
    path = `signatures/${input.jobId}/${Date.now()}-${randomBytes(4).toString("hex")}.png`;
    const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: "image/png", upsert: false });
    if (uploadError) return { ok: false, error: uploadError.message };
  }

  const { error } = await supabase.from("chillbros_job_signatures").insert({
    job_id: input.jobId,
    signer_name: signerName,
    storage_path: path,
    customer_unavailable: unavailable,
    captured_by: access.profile.id,
  });
  if (error) {
    if (path) await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    return { ok: false, error: error.message };
  }
  await supabase.from("chillbros_workflow_events").insert({
    job_id: input.jobId,
    actor_id: access.profile.id,
    stage: "onsite_signature",
    message: unavailable
      ? `${access.profile.fullName} recorded that the customer was unavailable to sign.`
      : `Customer ${signerName} signed off on site (captured by ${access.profile.fullName}).`,
  });
  refreshJob(input.jobId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Repair / return report. Stored as a workflow event (same JSON-in-message
// pattern as diagnostic readings) so it never overwrites the diagnosis notes.

export async function saveRepairReportAction(input: { jobId: string; outcome: string; workPerformed: string; finalNotes: string }): Promise<Result> {
  const access = await requireJobAccess(input.jobId, false);
  if (!access.ok) return access;
  if (!isRepairOutcome(input.outcome)) return { ok: false, error: "Choose Completed, Returning with parts, or Temporary repair." };
  const workPerformed = String(input.workPerformed ?? "").trim().slice(0, 4000);
  const finalNotes = String(input.finalNotes ?? "").trim().slice(0, 2000);
  if (!workPerformed && !finalNotes) return { ok: false, error: "Add the work performed or a final note." };

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("chillbros_workflow_events").insert({
    job_id: input.jobId,
    actor_id: access.profile.id,
    stage: "repair_report",
    message: JSON.stringify({ outcome: input.outcome, outcomeLabel: REPAIR_OUTCOMES[input.outcome], workPerformed, finalNotes }),
  });
  if (error) return { ok: false, error: error.message };
  refreshJob(input.jobId);
  return { ok: true };
}
