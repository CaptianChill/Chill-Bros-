-- Field Notes AI: technician handwritten note intake + owner review inbox.
-- Reuses existing chillbros_profiles/customers/jobs/equipment; adds no new
-- Neon project. Original technician photos are immutable source records
-- (never overwritten or deleted by AI processing or owner edits).

CREATE TYPE public.chillbros_field_note_status AS ENUM (
  'submitted',
  'processing',
  'needs_review',
  'ready',
  'approved',
  'completed',
  'processing_failed'
);

CREATE TABLE public.chillbros_field_note_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES public.chillbros_profiles(id),
  customer_id uuid REFERENCES public.chillbros_customers(id),
  job_id uuid REFERENCES public.chillbros_jobs(id),
  equipment_id uuid REFERENCES public.chillbros_equipment(id),
  customer_name_freeform text,
  status public.chillbros_field_note_status NOT NULL DEFAULT 'submitted',
  technician_note text,
  raw_transcription text,
  customer_complaint text,
  diagnosis text,
  work_performed text,
  materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  labor_hours numeric,
  drive_hours numeric,
  equipment_status text,
  recommendations text,
  follow_up_required boolean NOT NULL DEFAULT false,
  cleaned_internal_notes text,
  customer_summary text,
  confidence_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_model text,
  ai_error text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.chillbros_profiles(id),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chillbros_field_note_submissions_customer_reference_chk
    CHECK (customer_id IS NOT NULL OR customer_name_freeform IS NOT NULL)
);

CREATE INDEX chillbros_field_note_submissions_technician_idx
  ON public.chillbros_field_note_submissions (technician_id, submitted_at DESC);
CREATE INDEX chillbros_field_note_submissions_status_idx
  ON public.chillbros_field_note_submissions (status, submitted_at DESC);
CREATE INDEX chillbros_field_note_submissions_customer_idx
  ON public.chillbros_field_note_submissions (customer_id);
CREATE INDEX chillbros_field_note_submissions_job_idx
  ON public.chillbros_field_note_submissions (job_id);

CREATE TRIGGER chillbros_field_note_submissions_set_updated_at
  BEFORE UPDATE ON public.chillbros_field_note_submissions
  FOR EACH ROW EXECUTE FUNCTION public.chillbros_set_updated_at();

-- Original technician photographs. Immutable source records: rows are
-- inserted once at submission time and never rewritten by later AI
-- processing or owner edits.
CREATE TABLE public.chillbros_field_note_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.chillbros_field_note_submissions(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  filename text,
  mime_type text,
  page_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chillbros_field_note_images_submission_idx
  ON public.chillbros_field_note_images (submission_id, page_number);

-- Audit trail: submission, AI processing, owner edits, approval, completion.
CREATE TABLE public.chillbros_field_note_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.chillbros_field_note_submissions(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.chillbros_profiles(id),
  stage text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chillbros_field_note_events_submission_idx
  ON public.chillbros_field_note_events (submission_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
