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

const MEDIA_BUCKET = "chillbros-media";
const SIGNED_URL_TTL_SECONDS = 3600;

type SubmissionRow = {
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
  " processed_at, approved_at, approved_by, completed_at," +
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
  const supabase = createServiceRoleClient();
  const [{ count: newCount }, { count: needsReviewCount }, { count: approvedCount }] = await Promise.all([
    supabase.from("chillbros_field_note_submissions").select("id", { count: "exact", head: true }).in("status", ["submitted", "processing"]),
    supabase.from("chillbros_field_note_submissions").select("id", { count: "exact", head: true }).in("status", ["needs_review", "ready", "processing_failed"]),
    supabase.from("chillbros_field_note_submissions").select("id", { count: "exact", head: true }).eq("status", "approved"),
  ]);
  return { new: newCount ?? 0, needsReview: needsReviewCount ?? 0, approved: approvedCount ?? 0 };
}

async function imageCountsBySubmission(submissionIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (submissionIds.length === 0) return counts;
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_field_note_images").select("submission_id").in("submission_id", submissionIds);
  for (const row of data ?? []) counts.set(row.submission_id, (counts.get(row.submission_id) ?? 0) + 1);
  return counts;
}

export async function getFieldNoteInbox(statuses?: FieldNoteStatus[]): Promise<FieldNoteSubmissionSummary[]> {
  const supabase = createServiceRoleClient();
  let query = supabase.from("chillbros_field_note_submissions").select(SUMMARY_SELECT).order("submitted_at", { ascending: false }).limit(200);
  if (statuses && statuses.length > 0) query = query.in("status", statuses);
  const { data, error } = await query;
  if (error || !data) return [];
  const rows = data as unknown as SubmissionRow[];
  const counts = await imageCountsBySubmission(rows.map((row) => row.id));
  return rows.map((row) => toSummary(row, counts.get(row.id) ?? 0));
}

export async function getTechnicianFieldNotes(technicianId: string, limit = 20): Promise<FieldNoteSubmissionSummary[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("chillbros_field_note_submissions")
    .select(SUMMARY_SELECT)
    .eq("technician_id", technicianId)
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const rows = data as unknown as SubmissionRow[];
  const counts = await imageCountsBySubmission(rows.map((row) => row.id));
  return rows.map((row) => toSummary(row, counts.get(row.id) ?? 0));
}

export async function getFieldNoteSubmission(id: string): Promise<FieldNoteSubmission | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_field_note_submissions").select(DETAIL_SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as SubmissionRow;

  const [{ data: imageRows }, { data: eventRows }] = await Promise.all([
    supabase.from("chillbros_field_note_images").select("id, storage_path, filename, mime_type, page_number").eq("submission_id", id).order("page_number", { ascending: true }),
    supabase
      .from("chillbros_field_note_events")
      .select("id, actor_id, stage, message, created_at, actor:chillbros_profiles(full_name)")
      .eq("submission_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const paths = (imageRows ?? []).map((image) => image.storage_path);
  const signedUrlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    for (const entry of signed ?? []) if (entry.signedUrl && entry.path) signedUrlByPath.set(entry.path, entry.signedUrl);
  }

  const images: FieldNoteImage[] = (imageRows ?? []).map((image) => ({
    id: image.id,
    storagePath: image.storage_path,
    filename: image.filename,
    mimeType: image.mime_type,
    pageNumber: image.page_number,
    url: signedUrlByPath.get(image.storage_path) ?? null,
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
