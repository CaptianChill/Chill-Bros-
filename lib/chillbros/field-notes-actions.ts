"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { processFieldNoteImages } from "./field-notes-ai";
import type { FieldNoteMaterial, FieldNoteStatus } from "./field-notes-types";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const MEDIA_BUCKET = "chillbros-media";
const IMAGE_TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/heic", "heic"]]);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGES = 10;
const SIGNED_URL_TTL_SECONDS = 600;

async function requireFieldStaff() {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (!["technician", "manager"].includes(profile.role)) return { ok: false as const, error: "Technician or manager access required." };
  return { ok: true as const, profile };
}

async function requireManager() {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (profile.role !== "manager") return { ok: false as const, error: "Manager access required." };
  return { ok: true as const, profile };
}

async function logEvent(supabase: ReturnType<typeof createServiceRoleClient>, submissionId: string, actorId: string | null, stage: string, message: string, metadata?: unknown) {
  await supabase.from("chillbros_field_note_events").insert({ submission_id: submissionId, actor_id: actorId, stage, message, metadata: metadata ?? null });
}

function revalidateFieldNotes(submissionId?: string) {
  revalidatePath("/field-notes");
  revalidatePath("/owner/field-notes");
  if (submissionId) revalidatePath(`/owner/field-notes/${submissionId}`);
}

async function runAiProcessing(submissionId: string) {
  const supabase = createServiceRoleClient();

  const { data: images } = await supabase
    .from("chillbros_field_note_images")
    .select("storage_path")
    .eq("submission_id", submissionId)
    .order("page_number", { ascending: true });
  const paths = (images ?? []).map((image) => image.storage_path);
  if (paths.length === 0) {
    await supabase.from("chillbros_field_note_submissions").update({ status: "processing_failed", ai_error: "No images were found for this submission." }).eq("id", submissionId);
    return;
  }

  const { data: signed } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  const imageUrls = (signed ?? []).map((entry) => entry.signedUrl).filter((url): url is string => Boolean(url));
  if (imageUrls.length === 0) {
    await supabase.from("chillbros_field_note_submissions").update({ status: "processing_failed", ai_error: "Could not create signed URLs for the submitted images." }).eq("id", submissionId);
    return;
  }

  const { data: submission } = await supabase
    .from("chillbros_field_note_submissions")
    .select("technician_note, customer_id, equipment_id, customer_name_freeform, customer:chillbros_customers(name)")
    .eq("id", submissionId)
    .maybeSingle();

  const customer = Array.isArray(submission?.customer) ? submission.customer[0] : submission?.customer;
  const customerName = customer?.name ?? submission?.customer_name_freeform ?? null;

  let equipmentContext: string | null = null;
  if (submission?.equipment_id) {
    const { data: equipment } = await supabase.from("chillbros_equipment").select("equipment_type, manufacturer, model, serial_number, refrigerant").eq("id", submission.equipment_id).maybeSingle();
    if (equipment) equipmentContext = [equipment.equipment_type, equipment.manufacturer, equipment.model, equipment.serial_number ? `SN ${equipment.serial_number}` : null, equipment.refrigerant].filter(Boolean).join(" / ");
  }

  const result = await processFieldNoteImages({ imageUrls, technicianNote: submission?.technician_note ?? null, customerName, equipmentContext });

  if (!result.ok) {
    await supabase.from("chillbros_field_note_submissions").update({ status: "processing_failed", ai_error: result.error, processed_at: new Date().toISOString() }).eq("id", submissionId);
    await logEvent(supabase, submissionId, null, "processing_failed", `AI processing failed: ${result.error}`);
    return;
  }

  const hasFlags = result.data.confidenceFlags.length > 0;
  const nextStatus: FieldNoteStatus = hasFlags || !submission?.customer_id ? "needs_review" : "ready";

  await supabase.from("chillbros_field_note_submissions").update({
    status: nextStatus,
    raw_transcription: result.data.rawTranscription,
    customer_complaint: result.data.customerComplaint,
    diagnosis: result.data.diagnosis,
    work_performed: result.data.workPerformed,
    materials: result.data.materials satisfies FieldNoteMaterial[],
    labor_hours: result.data.laborHours,
    drive_hours: result.data.driveHours,
    equipment_status: result.data.equipmentStatus,
    recommendations: result.data.recommendations,
    follow_up_required: result.data.followUpRequired,
    cleaned_internal_notes: result.data.cleanedInternalNotes,
    customer_summary: result.data.customerSummary,
    confidence_flags: result.data.confidenceFlags,
    ai_model: result.model,
    ai_error: null,
    processed_at: new Date().toISOString(),
  }).eq("id", submissionId);

  await logEvent(supabase, submissionId, null, nextStatus, hasFlags ? "AI processing complete. Some fields need owner review." : "AI processing complete.");
}

export async function createFieldNoteSubmissionAction(
  input: { customerId: string | null; customerNameFreeform: string | null; jobId: string | null; equipmentId: string | null; technicianNote: string },
  files: File[],
): Promise<ActionResult<{ id: string }>> {
  const guard = await requireFieldStaff();
  if (!guard.ok) return guard;
  const { profile } = guard;

  if (!input.customerId && !input.customerNameFreeform?.trim()) return { ok: false, error: "Choose a customer or type a customer name." };
  if (!files || files.length === 0) return { ok: false, error: "Take or upload at least one photo of your notes." };
  if (files.length > MAX_IMAGES) return { ok: false, error: `Upload at most ${MAX_IMAGES} photos per submission.` };
  for (const file of files) {
    if (file.size === 0) return { ok: false, error: "One of the selected photos is empty." };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Each photo must be smaller than 12MB." };
    if (!IMAGE_TYPES.has(file.type)) return { ok: false, error: "Photos must be JPEG, PNG, WebP, or HEIC." };
  }

  const supabase = createServiceRoleClient();

  const { data: submission, error: insertError } = await supabase
    .from("chillbros_field_note_submissions")
    .insert({
      technician_id: profile.id,
      customer_id: input.customerId,
      customer_name_freeform: input.customerId ? null : input.customerNameFreeform?.trim() || null,
      job_id: input.jobId,
      equipment_id: input.equipmentId,
      technician_note: input.technicianNote.trim() || null,
      status: "submitted",
    })
    .select("id")
    .single();
  if (insertError || !submission) return { ok: false, error: insertError?.message ?? "Could not create the submission." };

  const submissionId = submission.id as string;
  const uploadedPaths: string[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const extension = IMAGE_TYPES.get(file.type)!;
    const path = `field-notes/${submissionId}/${index + 1}-${Date.now()}-${randomBytes(4).toString("hex")}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      await supabase.storage.from(MEDIA_BUCKET).remove(uploadedPaths);
      await supabase.from("chillbros_field_note_submissions").delete().eq("id", submissionId);
      return { ok: false, error: `Photo upload failed: ${uploadError.message}` };
    }
    uploadedPaths.push(path);
    const { error: imageInsertError } = await supabase.from("chillbros_field_note_images").insert({
      submission_id: submissionId,
      storage_path: path,
      filename: file.name || null,
      mime_type: file.type,
      page_number: index + 1,
    });
    if (imageInsertError) {
      await supabase.storage.from(MEDIA_BUCKET).remove(uploadedPaths);
      await supabase.from("chillbros_field_note_submissions").delete().eq("id", submissionId);
      return { ok: false, error: `Could not record photo: ${imageInsertError.message}` };
    }
  }

  await logEvent(supabase, submissionId, profile.id, "submitted", `${profile.fullName} sent ${files.length} photo${files.length === 1 ? "" : "s"} to the office.`);

  await supabase.from("chillbros_field_note_submissions").update({ status: "processing" }).eq("id", submissionId);
  await runAiProcessing(submissionId);

  revalidateFieldNotes(submissionId);
  return { ok: true, data: { id: submissionId } };
}

export async function retryFieldNoteProcessingAction(submissionId: string): Promise<ActionResult> {
  const guard = await requireFieldStaff();
  if (!guard.ok) return guard;

  const supabase = createServiceRoleClient();
  const { data: submission } = await supabase.from("chillbros_field_note_submissions").select("id, status").eq("id", submissionId).maybeSingle();
  if (!submission) return { ok: false, error: "Submission not found." };
  if (!["processing_failed", "needs_review", "ready"].includes(submission.status)) return { ok: false, error: "This submission is not eligible for reprocessing." };

  await supabase.from("chillbros_field_note_submissions").update({ status: "processing", ai_error: null }).eq("id", submissionId);
  await logEvent(supabase, submissionId, guard.profile.id, "processing", `${guard.profile.fullName} requested AI reprocessing.`);
  await runAiProcessing(submissionId);

  revalidateFieldNotes(submissionId);
  return { ok: true, data: undefined };
}

export type FieldNoteEditableFields = Partial<{
  customerComplaint: string;
  diagnosis: string;
  workPerformed: string;
  materials: FieldNoteMaterial[];
  laborHours: number | null;
  driveHours: number | null;
  equipmentStatus: string;
  recommendations: string;
  followUpRequired: boolean;
  cleanedInternalNotes: string;
  customerSummary: string;
}>;

export async function updateFieldNoteSubmissionAction(submissionId: string, patch: FieldNoteEditableFields): Promise<ActionResult> {
  const guard = await requireManager();
  if (!guard.ok) return guard;

  const supabase = createServiceRoleClient();
  const update: Record<string, unknown> = {};
  if ("customerComplaint" in patch) update.customer_complaint = patch.customerComplaint;
  if ("diagnosis" in patch) update.diagnosis = patch.diagnosis;
  if ("workPerformed" in patch) update.work_performed = patch.workPerformed;
  if ("materials" in patch) update.materials = patch.materials;
  if ("laborHours" in patch) update.labor_hours = patch.laborHours;
  if ("driveHours" in patch) update.drive_hours = patch.driveHours;
  if ("equipmentStatus" in patch) update.equipment_status = patch.equipmentStatus;
  if ("recommendations" in patch) update.recommendations = patch.recommendations;
  if ("followUpRequired" in patch) update.follow_up_required = patch.followUpRequired;
  if ("cleanedInternalNotes" in patch) update.cleaned_internal_notes = patch.cleanedInternalNotes;
  if ("customerSummary" in patch) update.customer_summary = patch.customerSummary;
  if (Object.keys(update).length === 0) return { ok: false, error: "Nothing to update." };

  const { error } = await supabase.from("chillbros_field_note_submissions").update(update).eq("id", submissionId);
  if (error) return { ok: false, error: error.message };

  await logEvent(supabase, submissionId, guard.profile.id, "edited", `${guard.profile.fullName} edited the field note record.`, { fields: Object.keys(update) });
  revalidateFieldNotes(submissionId);
  return { ok: true, data: undefined };
}

export async function linkFieldNoteSubmissionAction(submissionId: string, links: { customerId?: string | null; jobId?: string | null; equipmentId?: string | null }): Promise<ActionResult> {
  const guard = await requireManager();
  if (!guard.ok) return guard;

  const supabase = createServiceRoleClient();
  const update: Record<string, unknown> = {};
  if ("customerId" in links) { update.customer_id = links.customerId; if (links.customerId) update.customer_name_freeform = null; }
  if ("jobId" in links) update.job_id = links.jobId;
  if ("equipmentId" in links) update.equipment_id = links.equipmentId;

  const { error } = await supabase.from("chillbros_field_note_submissions").update(update).eq("id", submissionId);
  if (error) return { ok: false, error: error.message };

  await logEvent(supabase, submissionId, guard.profile.id, "linked", `${guard.profile.fullName} linked this submission to the customer record.`, links);
  revalidateFieldNotes(submissionId);
  return { ok: true, data: undefined };
}

export async function approveFieldNoteSubmissionAction(submissionId: string): Promise<ActionResult> {
  const guard = await requireManager();
  if (!guard.ok) return guard;

  const supabase = createServiceRoleClient();
  const { data: submission } = await supabase.from("chillbros_field_note_submissions").select("status, cleaned_internal_notes, customer_summary").eq("id", submissionId).maybeSingle();
  if (!submission) return { ok: false, error: "Submission not found." };
  if (submission.status === "approved" || submission.status === "completed") return { ok: false, error: "This submission is already approved." };
  if (!submission.cleaned_internal_notes?.trim() || !submission.customer_summary?.trim()) return { ok: false, error: "Internal notes and a customer summary are required before approval." };

  const now = new Date().toISOString();
  const { error } = await supabase.from("chillbros_field_note_submissions").update({ status: "approved", approved_at: now, approved_by: guard.profile.id }).eq("id", submissionId);
  if (error) return { ok: false, error: error.message };

  await logEvent(supabase, submissionId, guard.profile.id, "approved", `${guard.profile.fullName} approved this field note.`);
  revalidateFieldNotes(submissionId);
  return { ok: true, data: undefined };
}

export async function completeFieldNoteSubmissionAction(submissionId: string): Promise<ActionResult> {
  const guard = await requireManager();
  if (!guard.ok) return guard;

  const supabase = createServiceRoleClient();
  const { data: submission } = await supabase.from("chillbros_field_note_submissions").select("status").eq("id", submissionId).maybeSingle();
  if (!submission) return { ok: false, error: "Submission not found." };
  if (submission.status !== "approved") return { ok: false, error: "Approve this field note before completing it." };

  const { error } = await supabase.from("chillbros_field_note_submissions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", submissionId);
  if (error) return { ok: false, error: error.message };

  await logEvent(supabase, submissionId, guard.profile.id, "completed", `${guard.profile.fullName} marked this field note complete.`);
  revalidateFieldNotes(submissionId);
  return { ok: true, data: undefined };
}
