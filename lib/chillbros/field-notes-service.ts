import "server-only";
import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type { StaffProfile } from "@/lib/supabase/auth-server";
import { processFieldNoteImages } from "./field-notes-ai";
import type { FieldNoteStatus } from "./field-notes-types";

export const FIELD_NOTES_BUCKET = "chillbros-media";
export const FIELD_NOTE_IMAGE_LIMIT = 3 * 1024 * 1024;
export const FIELD_NOTE_LEASE_MS = 10 * 60 * 1000;
export const UPLOAD_PENDING = "Waiting for photo upload. Reopen the saved draft to finish sending.";
export type FieldNoteRow = {
  id: string; technician_id: string; customer_id: string | null; job_id: string | null;
  equipment_id: string | null; customer_name_freeform: string | null; technician_note: string | null;
  status: FieldNoteStatus; updated_at: string; ai_error: string | null;
  cleaned_internal_notes: string | null; customer_summary: string | null;
  [key: string]: unknown;
};
export type NoteLinks = { customerId: string | null; jobId: string | null; equipmentId: string | null };
export type NoteInput = NoteLinks & { id: string; customerNameFreeform: string | null; technicianNote: string };
export type PhotoDescriptor = { name: string; size: number; sha256: string };
export type NoteImageRow = { id: string; storage_path: string; filename: string | null; mime_type: string; page_number: number };

export function requireUuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("Invalid record reference.");
}
export function checkDb(error: { message: string } | null, context = "Database request failed") {
  if (error) { console.error(`[field-notes] ${context}`, error.message); throw new Error(`${context}. Please retry; if this continues, contact the office.`); }
}
export async function readNote(id: string): Promise<FieldNoteRow> {
  requireUuid(id);
  const { data, error } = await createServiceRoleClient().from("chillbros_field_note_submissions").select("*").eq("id", id).maybeSingle();
  checkDb(error, "Could not load the field note");
  if (!data) throw new Error("Submission not found.");
  return data as FieldNoteRow;
}
export function requireNoteAccess(note: FieldNoteRow, profile: StaffProfile) {
  if (profile.role !== "manager" && note.technician_id !== profile.id) throw new Error("You do not have access to this submission.");
}
export async function noteImages(id: string): Promise<NoteImageRow[]> {
  const { data, error } = await createServiceRoleClient().from("chillbros_field_note_images").select("id,storage_path,filename,mime_type,page_number").eq("submission_id", id).order("page_number");
  checkDb(error, "Could not load the photos");
  return (data ?? []) as NoteImageRow[];
}
export async function recordNoteEvent(id: string, actor: string | null, stage: string, message: string, metadata: unknown = null) {
  const { error } = await createServiceRoleClient().from("chillbros_field_note_events").insert({ submission_id: id, actor_id: actor, stage, message, metadata });
  checkDb(error, "The record was saved but its audit entry could not be saved");
}
// Compare-and-swap protects saved reviews against another tab and delayed AI work.
export async function changeNote(note: FieldNoteRow, patch: Record<string, unknown>): Promise<FieldNoteRow> {
  const { data, error } = await createServiceRoleClient().from("chillbros_field_note_submissions")
    .update(patch).eq("id", note.id).eq("updated_at", note.updated_at).eq("status", note.status).select("*").maybeSingle();
  checkDb(error, "Could not save the field note");
  if (!data) throw new Error("This note changed in another window. Refresh it before continuing.");
  return data as FieldNoteRow;
}
export async function validateNoteLinks(links: NoteLinks, profile: StaffProfile) {
  const db = createServiceRoleClient();
  for (const id of [links.customerId, links.jobId, links.equipmentId]) if (id) requireUuid(id);
  if (links.customerId) {
    const { data, error } = await db.from("chillbros_customers").select("id").eq("id", links.customerId).maybeSingle();
    checkDb(error); if (!data) throw new Error("Customer not found.");
  }
  if (links.jobId) {
    const { data, error } = await db.from("chillbros_jobs").select("customer_id,assigned_tech_id,archived_at").eq("id", links.jobId).maybeSingle();
    checkDb(error);
    if (!data || data.archived_at || data.customer_id !== links.customerId) throw new Error("Choose a job belonging to this customer.");
    if (profile.role !== "manager" && data.assigned_tech_id !== profile.id) throw new Error("Only your assigned jobs can be submitted.");
  }
  if (links.equipmentId) {
    const { data, error } = await db.from("chillbros_equipment").select("customer_id").eq("id", links.equipmentId).maybeSingle();
    checkDb(error); if (!data || data.customer_id !== links.customerId) throw new Error("Choose equipment belonging to this customer.");
  }
}
function photoId(id: string, index: number) {
  const hex = createHash("sha256").update(`${id}:${index}`).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
export async function prepareNote(input: NoteInput, photos: PhotoDescriptor[], profile: StaffProfile) {
  requireUuid(input.id);
  if (!input.customerId && !input.customerNameFreeform?.trim()) throw new Error("Choose a customer or type a customer name.");
  if (input.technicianNote.length > 10000 || (input.customerNameFreeform?.length ?? 0) > 200) throw new Error("The note or customer name is too long.");
  if (!photos.length && !input.technicianNote.trim()) throw new Error("Type your notes or add at least one photo.");
  if (photos.length > 10) throw new Error("Choose up to 10 photos.");
  for (const photo of photos) if (!Number.isInteger(photo.size) || photo.size <= 0 || photo.size > FIELD_NOTE_IMAGE_LIMIT || !/^[a-f0-9]{64}$/.test(photo.sha256)) throw new Error("A photo could not be prepared. Please select it again.");
  await validateNoteLinks(input, profile);
  const db = createServiceRoleClient();
  if (photos.length) {
  const { data: bucket, error: bucketError } = await db.storage.getBucket(FIELD_NOTES_BUCKET);
  checkDb(bucketError, "Private photo storage is unavailable");
  if (!bucket || bucket.public) throw new Error("Photo storage must be private. Contact the office.");
  }
  const { data: existing, error: readError } = await db.from("chillbros_field_note_submissions").select("*").eq("id", input.id).maybeSingle();
  checkDb(readError);
  if (!existing) {
    const { count, error: countError } = await db.from("chillbros_field_note_submissions").select("id", { count: "exact", head: true }).eq("technician_id", profile.id).eq("status", "submitted");
    checkDb(countError);
    if ((count ?? 0) >= 20) throw new Error("There are too many unfinished submissions. Ask the office to review them.");
    const { error } = await db.from("chillbros_field_note_submissions").insert({ id: input.id, technician_id: profile.id, customer_id: input.customerId, job_id: input.jobId, equipment_id: input.equipmentId, customer_name_freeform: input.customerId ? null : input.customerNameFreeform?.trim(), technician_note: input.technicianNote.trim() || null, status: "submitted", ai_error: UPLOAD_PENDING });
    if (error?.code !== "23505") checkDb(error, "Could not start the submission");
  }
  const note = await readNote(input.id);
  requireNoteAccess(note, profile);
  if (note.technician_id !== profile.id) throw new Error("This submission belongs to a different technician.");
  if (note.status !== "submitted" || note.ai_error !== UPLOAD_PENDING) return { id: note.id, sent: true, images: [] as NoteImageRow[] };
  if (note.customer_id !== input.customerId || note.job_id !== input.jobId || note.equipment_id !== input.equipmentId || (note.technician_note ?? "") !== input.technicianNote.trim() || (!input.customerId && note.customer_name_freeform !== input.customerNameFreeform?.trim())) throw new Error("This saved submission has different details. Refresh and finish the original draft.");
  const descriptors = photos.map((p, i) => ({ id: photoId(note.id, i), submission_id: note.id, storage_path: `field-notes/${note.id}/${i+1}-${p.sha256}.jpg`, filename: p.name.slice(0,200), mime_type: "image/jpeg", page_number: i+1 }));
  const previous = await noteImages(note.id);
  if (previous.some(p => !descriptors.some(d => p.id === d.id && p.storage_path === d.storage_path))) throw new Error("This saved draft has different photos. Finish the original draft before starting another.");
  if (descriptors.length) {
    const { error } = await db.from("chillbros_field_note_images").upsert(descriptors, { onConflict: "id", ignoreDuplicates: true });
    checkDb(error, "Could not reserve the photos");
  }
  const reserved = await noteImages(note.id);
  if (reserved.length !== descriptors.length || reserved.some(p => !descriptors.some(d => p.id === d.id && p.storage_path === d.storage_path))) throw new Error("The saved photo list changed in another window. Refresh before continuing.");
  return { id: note.id, sent: false, images: reserved };
}
export async function uploadNoteImage(id: string, imageId: string, bytes: Uint8Array, profile: StaffProfile) {
  const note = await readNote(id); requireNoteAccess(note, profile);
  if (note.status !== "submitted" || note.ai_error !== UPLOAD_PENDING) throw new Error("This submission has already been sent.");
  if (bytes.length < 3 || bytes.length > FIELD_NOTE_IMAGE_LIMIT || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error("Choose a valid JPEG photo under 3 MB.");
  const image = (await noteImages(id)).find(row => row.id === imageId);
  if (!image) throw new Error("Photo reference not found.");
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (!image.storage_path.endsWith(`-${digest}.jpg`)) throw new Error("The photo changed. Please select it again.");
  const bucket = createServiceRoleClient().storage.from(FIELD_NOTES_BUCKET);
  const { error } = await bucket.upload(image.storage_path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error && !["409", "Duplicate"].includes(String(error.statusCode)) && !/already exists/i.test(error.message)) checkDb(error, "Could not upload the photo");
}
export async function finishNoteUpload(id: string, profile: StaffProfile) {
  const note = await readNote(id); requireNoteAccess(note, profile);
  if (note.status !== "submitted" || note.ai_error !== UPLOAD_PENDING) return;
  const images = await noteImages(id);
  if (!images.length && !note.technician_note?.trim()) throw new Error("Type your notes or add at least one photo.");
  for (const image of images) {
    const { data, error } = await createServiceRoleClient().storage.from(FIELD_NOTES_BUCKET).info(image.storage_path);
    checkDb(error, `Photo ${image.page_number} has not finished uploading`);
    if (!data || Number(data.size) <= 0 || Number(data.size) > FIELD_NOTE_IMAGE_LIMIT) throw new Error(`Photo ${image.page_number} is invalid.`);
  }
  await changeNote(note, { ai_error: null });
  await recordNoteEvent(id, profile.id, "submitted", `${profile.fullName} sent ${images.length} photos to the office.`, { photoCount: images.length });
}
export async function processNote(id: string, allowRetry = false) {
  let note = await readNote(id);
  if (note.status === "submitted" && note.ai_error === UPLOAD_PENDING) return;
  const stale = note.status === "processing" && Date.now() - Date.parse(note.updated_at) > FIELD_NOTE_LEASE_MS;
  if (note.status !== "submitted" && !stale && !(allowRetry && note.status === "processing_failed")) return;
  note = await changeNote(note, { status: "processing", ai_error: null });
  try {
    const images = await noteImages(id);
    if (!images.length && !note.technician_note?.trim()) throw new Error("No notes or photos are available.");
    let imageUrls: string[] = [];
    if (images.length) {
    const { data, error } = await createServiceRoleClient().storage.from(FIELD_NOTES_BUCKET).createSignedUrls(images.map(i => i.storage_path), 600);
    checkDb(error, "Could not open the photos");
    if (!data || data.length !== images.length || data.some(item => item.error || !item.signedUrl)) throw new Error("Not all pages could be opened. Retry processing.");
    imageUrls = data.map(item => item.signedUrl!);
    }
    const result = await processFieldNoteImages({ imageUrls, technicianNote: note.technician_note, customerName: note.customer_name_freeform, equipmentContext: null });
    if (!result.ok) throw new Error(result.error);
    const r = result.data;
    const saved = await changeNote(note, { status: r.confidenceFlags.length || !note.customer_id ? "needs_review" : "ready", raw_transcription: r.rawTranscription, customer_complaint: r.customerComplaint, diagnosis: r.diagnosis, work_performed: r.workPerformed, materials: r.materials, labor_hours: r.laborHours, drive_hours: r.driveHours, equipment_status: r.equipmentStatus, recommendations: r.recommendations, follow_up_required: r.followUpRequired, cleaned_internal_notes: r.cleanedInternalNotes, customer_summary: r.customerSummary, invoice_description: r.invoiceDescription, confidence_flags: r.confidenceFlags, ai_model: result.model, ai_error: null, processed_at: new Date().toISOString() });
    await recordNoteEvent(id, null, saved.status, "AI processing finished. Owner review is required.");
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Processing failed.";
    // A lost lease must not overwrite a newer worker's result or owner review.
    const current = await readNote(id);
    if (current.status !== "processing" || current.updated_at !== note.updated_at) { console.error("[field-notes] processing completion", message); return; }
    await changeNote(note, { status: "processing_failed", ai_error: message.slice(0,1000), processed_at: new Date().toISOString() });
    await recordNoteEvent(id, null, "processing_failed", "AI processing failed; the photos are kept for retry.");
  }
}
export async function cleanupNotePhotos(id: string, actor: string | null) {
  const note = await readNote(id);
  if (note.status !== "completed") throw new Error("Complete the verified note before deleting its photos.");
  const images = await noteImages(id);
  if (!images.length) return;
  const db = createServiceRoleClient();
  const { error: storageError } = await db.storage.from(FIELD_NOTES_BUCKET).remove(images.map(i => i.storage_path));
  checkDb(storageError, "The completed text is saved, but photo cleanup needs retrying");
  const { error } = await db.from("chillbros_field_note_images").delete().eq("submission_id", id);
  checkDb(error, "Photos were removed but cleanup metadata needs retrying");
  await recordNoteEvent(id, actor, "photos_removed", "Temporary photos removed after owner verification. Approved text is retained.", { photoCount: images.length });
}
