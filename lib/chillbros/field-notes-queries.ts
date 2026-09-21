import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { checkDb } from "./field-notes-service";
import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type {
  FieldNoteConfidenceFlag,
  FieldNoteEvent,
  FieldNoteImage,
  FieldNoteInboxCounts,
  FieldNoteMaterial,
  FieldNoteStatus,
  FieldNoteSubmission,
  FieldNoteSubmissionSummary,
} from "./field-notes-types";



type SubmissionRow = {
  updated_at: string;
  id: string;
  technician_id: string;
  customer_id: string | null;
  customer_name_freeform: string | null;
  job_id: string | null;
  equipment_id: string | null;
  status: FieldNoteStatus;
  technician_note: string | null;
  raw_transcription: string | null;
  customer_complaint: string | null;
  diagnosis: string | null;
  work_performed: string | null;
  materials: FieldNoteMaterial[] | null;
  labor_hours: number | string | null;
  drive_hours: number | string | null;
  equipment_status: string | null;
  recommendations: string | null;
  follow_up_required: boolean;
  cleaned_internal_notes: string | null;
  customer_summary: string | null;
  confidence_flags: FieldNoteConfidenceFlag[] | null;
  ai_model: string | null;
  ai_error: string | null;
  submitted_at: string;
  processed_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  completed_at: string | null;
  technician: { full_name: string } | { full_name: string }[] | null;
  customer: { name: string } | { name: string }[] | null;
};

const SUMMARY_SELECT =
  "id, technician_id, customer_id, customer_name_freeform, job_id, equipment_id, status, submitted_at, confidence_flags," +
  " technician:chillbros_profiles!chillbros_field_note_submissions_technician_id_fkey(full_name)," +
  " customer:chillbros_customers(name)";

const DETAIL_SELECT =
  "id, technician_id, customer_id, customer_name_freeform, job_id, equipment_id, status, technician_note, raw_transcription," +
  " customer_complaint, diagnosis, work_performed, materials, labor_hours, drive_hours, equipment_status, recommendations," +
  " follow_up_required, cleaned_internal_notes, customer_summary, confidence_flags, ai_model, ai_error, submitted_at," +
  " processed_at, approved_at, approved_by, completed_at, updated_at," +
  " technician:chillbros_profiles!chillbros_field_note_submissions_technician_id_fkey(full_name)," +
  " customer:chillbros_customers(name)";

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function toSummary(row: SubmissionRow, imageCount: number): FieldNoteSubmissionSummary {
  const technician = one(row.technician);
  const customer = one(row.customer);
  return {
    id: row.id,
    technicianId: row.technician_id,
    technicianName: technician?.full_name ?? "Unknown technician",
    customerId: row.customer_id,
    customerName: customer?.name ?? null,
    customerNameFreeform: row.customer_name_freeform,
    jobId: row.job_id,
    equipmentId: row.equipment_id,
    status: row.status,
    imageCount,
    hasConfidenceFlags: (row.confidence_flags ?? []).length > 0,
    submittedAt: row.submitted_at,
  };
}

export async function getFieldNoteInboxCounts(): Promise<FieldNoteInboxCounts> {
  const profile = await getCurrentStaffProfile();
  if (profile?.role !== "manager") throw new Error("Manager access required.");
  const supabase = createServiceRoleClient();
  const [newResult, reviewResult, approvedResult] = await Promise.all([
    supabase.from("chillbros_field_note_submissions").select("id", { count: "exact", head: true }).in("status", ["submitted", "processing"]),
    supabase.from("chillbros_field_note_submissions").select("id", { count: "exact", head: true }).in("status", ["needs_review", "ready", "processing_failed"]),
    supabase.from("chillbros_field_note_submissions").select("id", { count: "exact", head: true }).eq("status", "approved"),
  ]);
  for (const result of [newResult, reviewResult, approvedResult]) checkDb(result.error, "Field Notes is unavailable");
  return { new: newResult.count ?? 0, needsReview: reviewResult.count ?? 0, approved: approvedResult.count ?? 0 };
}

async function imageCountsBySubmission(submissionIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (submissionIds.length === 0) return counts;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_field_note_images").select("submission_id").in("submission_id", submissionIds);
  checkDb(error);
  for (const row of data ?? []) counts.set(row.submission_id, (counts.get(row.submission_id) ?? 0) + 1);
  return counts;
}

export async function getFieldNoteInbox(statuses?: FieldNoteStatus[]): Promise<FieldNoteSubmissionSummary[]> {
  const profile = await getCurrentStaffProfile();
  if (profile?.role !== "manager") throw new Error("Manager access required.");
  const supabase = createServiceRoleClient();
  let query = supabase.from("chillbros_field_note_submissions").select(SUMMARY_SELECT).order("submitted_at", { ascending: false }).limit(200);
  if (statuses && statuses.length > 0) query = query.in("status", statuses);
  const { data, error } = await query;
  checkDb(error, "Could not load field notes");
  if (!data) return [];
  const rows = data as unknown as SubmissionRow[];
  const counts = await imageCountsBySubmission(rows.map((row) => row.id));
  return rows.map((row) => toSummary(row, counts.get(row.id) ?? 0));
}

export async function getTechnicianFieldNotes(technicianId: string, limit = 20): Promise<FieldNoteSubmissionSummary[]> {
  const profile = await getCurrentStaffProfile();
  if (!profile || (profile.role !== "manager" && profile.id !== technicianId)) throw new Error("Access denied.");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("chillbros_field_note_submissions")
    .select(SUMMARY_SELECT)
    .eq("technician_id", technicianId)
    .order("submitted_at", { ascending: false })
    .limit(limit);
  checkDb(error, "Could not load field notes");
  if (!data) return [];
  const rows = data as unknown as SubmissionRow[];
  const counts = await imageCountsBySubmission(rows.map((row) => row.id));
  return rows.map((row) => toSummary(row, counts.get(row.id) ?? 0));
}

export async function getFieldNoteSubmission(id: string): Promise<FieldNoteSubmission | null> {
  const profile = await getCurrentStaffProfile();
  if (profile?.role !== "manager") throw new Error("Manager access required.");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_field_note_submissions").select(DETAIL_SELECT).eq("id", id).maybeSingle();
  checkDb(error, "Could not load the field note");
  if (!data) return null;
  const row = data as unknown as SubmissionRow;

  const [imageResult, eventResult] = await Promise.all([
    supabase.from("chillbros_field_note_images").select("id, storage_path, filename, mime_type, page_number").eq("submission_id", id).order("page_number", { ascending: true }),
    supabase
      .from("chillbros_field_note_events")
      .select("id, actor_id, stage, message, created_at, actor:chillbros_profiles(full_name)")
      .eq("submission_id", id)
      .order("created_at", { ascending: true }),
  ]);

  checkDb(imageResult.error); checkDb(eventResult.error);
  const imageRows = imageResult.data; const eventRows = eventResult.data;
  const images: FieldNoteImage[] = (imageRows ?? []).map((image) => ({
    id: image.id,
    storagePath: image.storage_path,
    filename: image.filename,
    mimeType: image.mime_type,
    pageNumber: image.page_number,
    url: `/api/field-notes/${id}/images/${image.id}`,
  }));

  const events: FieldNoteEvent[] = (eventRows ?? []).map((event) => {
    const actor = one(event.actor as { full_name: string } | { full_name: string }[] | null);
    return {
      id: event.id,
      actorId: event.actor_id,
      actorName: actor?.full_name ?? null,
      stage: event.stage,
      message: event.message,
      createdAt: event.created_at,
    };
  });

  const technician = one(row.technician);
  const customer = one(row.customer);

  return {
    id: row.id,
    technicianId: row.technician_id,
    technicianName: technician?.full_name ?? "Unknown technician",
    customerId: row.customer_id,
    customerName: customer?.name ?? null,
    customerNameFreeform: row.customer_name_freeform,
    jobId: row.job_id,
    equipmentId: row.equipment_id,
    status: row.status,
    imageCount: images.length,
    hasConfidenceFlags: (row.confidence_flags ?? []).length > 0,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    technicianNote: row.technician_note,
    rawTranscription: row.raw_transcription,
    customerComplaint: row.customer_complaint,
    diagnosis: row.diagnosis,
    workPerformed: row.work_performed,
    materials: row.materials ?? [],
    laborHours: row.labor_hours === null ? null : Number(row.labor_hours),
    driveHours: row.drive_hours === null ? null : Number(row.drive_hours),
    equipmentStatus: row.equipment_status,
    recommendations: row.recommendations,
    followUpRequired: row.follow_up_required,
    cleanedInternalNotes: row.cleaned_internal_notes,
    customerSummary: row.customer_summary,
    confidenceFlags: row.confidence_flags ?? [],
    aiModel: row.ai_model,
    aiError: row.ai_error,
    processedAt: row.processed_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    completedAt: row.completed_at,
    images,
    events,
  };
}
