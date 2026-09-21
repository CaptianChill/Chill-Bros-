export type FieldNoteStatus =
  | "submitted"
  | "processing"
  | "needs_review"
  | "ready"
  | "approved"
  | "completed"
  | "processing_failed";

export const FIELD_NOTE_STATUS_LABELS: Record<FieldNoteStatus, string> = {
  submitted: "Submitted",
  processing: "Processing",
  needs_review: "Needs Review",
  ready: "Ready",
  approved: "Approved",
  completed: "Completed",
  processing_failed: "Processing Failed",
};

export const FIELD_NOTE_OPEN_STATUSES: FieldNoteStatus[] = [
  "submitted",
  "processing",
  "needs_review",
  "ready",
  "processing_failed",
];

export type FieldNoteConfidenceFlag = {
  field: string;
  value: string;
  reason: string;
};

export type FieldNoteMaterial = {
  description: string;
  quantity: string;
  partNumber: string | null;
  confidence: "high" | "low";
};

export type FieldNoteImage = {
  id: string;
  storagePath: string;
  filename: string | null;
  mimeType: string | null;
  pageNumber: number;
  url: string | null;
};

export type FieldNoteEvent = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  stage: string;
  message: string;
  createdAt: string;
};

export type FieldNoteSubmissionSummary = {
  id: string;
  technicianId: string;
  technicianName: string;
  customerId: string | null;
  customerName: string | null;
  customerNameFreeform: string | null;
  jobId: string | null;
  equipmentId: string | null;
  status: FieldNoteStatus;
  imageCount: number;
  hasConfidenceFlags: boolean;
  submittedAt: string;
};

export type FieldNoteSubmission = FieldNoteSubmissionSummary & {
  updatedAt: string;
  technicianNote: string | null;
  rawTranscription: string | null;
  customerComplaint: string | null;
  diagnosis: string | null;
  workPerformed: string | null;
  materials: FieldNoteMaterial[];
  laborHours: number | null;
  driveHours: number | null;
  equipmentStatus: string | null;
  recommendations: string | null;
  followUpRequired: boolean;
  cleanedInternalNotes: string | null;
  customerSummary: string | null;
  confidenceFlags: FieldNoteConfidenceFlag[];
  aiModel: string | null;
  aiError: string | null;
  processedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  completedAt: string | null;
  images: FieldNoteImage[];
  events: FieldNoteEvent[];
};

export type FieldNoteInboxCounts = {
  new: number;
  needsReview: number;
  approved: number;
};
