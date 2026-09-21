-- Apply after neon/migrations/202609200001_field_notes_ai.sql to the verified
-- operational database. All browser access uses authenticated server actions.
-- No customer or technician JWT may directly read the review inbox or photos.
BEGIN;
ALTER TABLE public.chillbros_field_note_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chillbros_field_note_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chillbros_field_note_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chillbros_field_note_submissions, public.chillbros_field_note_images, public.chillbros_field_note_events FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON public.chillbros_field_note_submissions, public.chillbros_field_note_images, public.chillbros_field_note_events FROM %I', r);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.chillbros_field_note_submissions, public.chillbros_field_note_images, public.chillbros_field_note_events TO service_role;
  END IF;
END $$;
COMMENT ON TABLE public.chillbros_field_note_images IS 'Temporary photos retained until owner verification and completion; approved text and events are permanent.';
NOTIFY pgrst, 'reload schema';
COMMIT;
