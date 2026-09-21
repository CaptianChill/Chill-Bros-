"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile, type StaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type { FieldNoteMaterial } from "./field-notes-types";
import { changeNote, checkDb, cleanupNotePhotos, finishNoteUpload, prepareNote, processNote, readNote, recordNoteEvent, requireNoteAccess, validateNoteLinks, FIELD_NOTE_LEASE_MS, UPLOAD_PENDING, type NoteInput, type NoteLinks, type PhotoDescriptor, type FieldNoteRow } from "./field-notes-service";

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };
async function action<T>(manager: boolean, fn: (profile: StaffProfile) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const profile = await getCurrentStaffProfile();
    if (!profile || !["technician", "manager"].includes(profile.role)) throw new Error("Please sign in as a technician or manager.");
    if (manager && profile.role !== "manager") throw new Error("Manager access required.");
    const data = await fn(profile);
    revalidatePath("/field-notes"); revalidatePath("/owner"); revalidatePath("/owner/field-notes", "layout");
    return { ok: true, data };
  } catch (cause) { return { ok: false, error: cause instanceof Error ? cause.message : "The action failed. Please retry." }; }
}
function queueProcessing(id: string, retry = false) {
  after(async () => { try { await processNote(id, retry); } catch (cause) { console.error("[field-notes] background processing", cause); } });
}
function assertVersion(note: FieldNoteRow, version: string) {
  if (!version || note.updated_at !== version) throw new Error("This note has changed. Refresh before continuing.");
}
function assertEditable(note: FieldNoteRow) {
  if (!["needs_review", "ready", "processing_failed"].includes(note.status)) throw new Error("Only unapproved notes that are not processing can be edited.");
}
export async function prepareFieldNoteSubmissionAction(input: NoteInput, photos: PhotoDescriptor[]) {
  return action(false, profile => prepareNote(input, photos, profile));
}
export async function finishFieldNoteSubmissionAction(id: string) {
  return action(false, async profile => { await finishNoteUpload(id, profile); queueProcessing(id); return { id }; });
}
export async function retryFieldNoteProcessingAction(id: string): Promise<ActionResult> {
  return action(false, async profile => {
    const note = await readNote(id); requireNoteAccess(note, profile);
    const stale = note.status === "processing" && Date.now() - Date.parse(note.updated_at) > FIELD_NOTE_LEASE_MS;
    if (note.ai_error === UPLOAD_PENDING) throw new Error("Finish uploading the saved draft on the technician's phone first.");
    if (!["submitted", "processing_failed"].includes(note.status) && !stale) throw new Error("This note is already processing or ready for review. Refresh in a few minutes.");
    queueProcessing(id, true);
  });
}
export type FieldNoteEditableFields = Partial<{
  customerComplaint: string; diagnosis: string; workPerformed: string; materials: FieldNoteMaterial[];
  laborHours: number | null; driveHours: number | null; equipmentStatus: string; recommendations: string;
  followUpRequired: boolean; cleanedInternalNotes: string; customerSummary: string; invoiceDescription: string;
}>;
export async function updateFieldNoteSubmissionAction(id: string, patch: FieldNoteEditableFields, version: string): Promise<ActionResult> {
  return action(true, async profile => {
    const note = await readNote(id); assertVersion(note, version); assertEditable(note);
    const names = { customerComplaint: "customer_complaint", diagnosis: "diagnosis", workPerformed: "work_performed", materials: "materials", laborHours: "labor_hours", driveHours: "drive_hours", equipmentStatus: "equipment_status", recommendations: "recommendations", followUpRequired: "follow_up_required", cleanedInternalNotes: "cleaned_internal_notes", customerSummary: "customer_summary", invoiceDescription: "invoice_description" };
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (!(key in names)) throw new Error("Unknown field.");
      if (key === "materials") {
        if (!Array.isArray(value) || value.length > 100 || value.some(v => !v || typeof v.description !== "string" || v.description.length > 1000 || typeof v.quantity !== "string" || v.quantity.length > 100 || (v.partNumber !== null && typeof v.partNumber !== "string") || !["high", "low"].includes(v.confidence))) throw new Error("Check the materials list.");
      } else if (["laborHours", "driveHours"].includes(key)) {
        if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1000)) throw new Error("Hours must be a number between 0 and 1000.");
      } else if (key === "followUpRequired") {
        if (typeof value !== "boolean") throw new Error("Invalid follow-up value.");
      } else if (typeof value !== "string" || value.length > 30000) throw new Error("A text field is invalid or too long.");
      update[names[key as keyof typeof names]] = value;
    }
    if (!Object.keys(update).length) throw new Error("Nothing to save.");
    await changeNote(note, update);
    await recordNoteEvent(id, profile.id, "edited", `${profile.fullName} saved a revised note.`, { before: Object.fromEntries(Object.keys(update).map(k => [k, note[k]])), after: update });
  });
}
export async function linkFieldNoteSubmissionAction(id: string, links: NoteLinks, version: string): Promise<ActionResult> {
  return action(true, async profile => {
    const note = await readNote(id); assertVersion(note, version); assertEditable(note);
    if (!links.customerId) throw new Error("Choose a customer.");
    await validateNoteLinks(links, profile);
    await changeNote(note, { customer_id: links.customerId, job_id: links.jobId, equipment_id: links.equipmentId, customer_name_freeform: null });
    await recordNoteEvent(id, profile.id, "linked", `${profile.fullName} linked this note to the customer record.`, links);
  });
}
export async function getFieldNoteLinkOptionsAction(customerId: string) {
  return action(true, async profile => {
    await validateNoteLinks({ customerId, jobId: null, equipmentId: null }, profile);
    const db = createServiceRoleClient();
    const [jobs, equipment] = await Promise.all([
      db.from("chillbros_jobs").select("id,scope,scheduled_window").eq("customer_id", customerId).is("archived_at", null).order("created_at", { ascending: false }).limit(200),
      db.from("chillbros_equipment").select("id,equipment_type,model,serial_number").eq("customer_id", customerId).limit(200),
    ]);
    checkDb(jobs.error); checkDb(equipment.error);
    return { jobs: (jobs.data ?? []).map(j => ({ id: String(j.id), label: [j.scheduled_window, j.scope].filter(Boolean).join(" · ") || String(j.id) })), equipment: (equipment.data ?? []).map(e => ({ id: String(e.id), label: [e.equipment_type, e.model, e.serial_number].filter(Boolean).join(" · ") })) };
  });
}
export async function approveFieldNoteSubmissionAction(id: string, version: string, reviewed: boolean): Promise<ActionResult> {
  return action(true, async profile => {
    const note = await readNote(id); assertVersion(note, version); assertEditable(note);
    if (!reviewed) throw new Error("Confirm you checked the text and flagged values against the original notes and photos.");
    if (!note.customer_id) throw new Error("Link this note to the correct customer before approval.");
    if (!note.cleaned_internal_notes?.trim() || !note.customer_summary?.trim()) throw new Error("Save internal notes and a customer summary before approval.");
    await changeNote(note, { status: "approved", approved_at: new Date().toISOString(), approved_by: profile.id });
    await recordNoteEvent(id, profile.id, "approved", `${profile.fullName} verified and approved the saved text.`, { internal: note.cleaned_internal_notes, customer: note.customer_summary, reviewedVersion: version });
  });
}
export async function completeFieldNoteSubmissionAction(id: string, version: string): Promise<ActionResult> {
  return action(true, async profile => {
    const note = await readNote(id); assertVersion(note, version);
    if (!["approved", "completed"].includes(note.status)) throw new Error("Approve the saved note before completing it.");
    if (note.status === "approved") {
      await changeNote(note, { status: "completed", completed_at: new Date().toISOString() });
      await recordNoteEvent(id, profile.id, "completed", `${profile.fullName} completed the verified customer service record. Approved text remains available in Field Notes.`);
    }
    await cleanupNotePhotos(id, profile.id);
  });
}
