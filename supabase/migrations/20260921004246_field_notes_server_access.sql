-- Apply after neon/migrations/202609200001_field_notes_ai.sql to the verified
-- operational database. All browser access uses authenticated server actions.
-- No customer or technician JWT may directly read the review inbox or photos.
BEGIN;
DO $$
DECLARE r text; t text;
BEGIN
  -- Fresh operational databases receive these tables in the following bootstrap
  -- migration. Existing Neon installations can be hardened immediately.
  FOREACH t IN ARRAY ARRAY['chillbros_field_note_submissions', 'chillbros_field_note_images', 'chillbros_field_note_events'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
      FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
          EXECUTE format('REVOKE ALL ON public.%I FROM %I', t, r);
        END IF;
      END LOOP;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
      END IF;
    END IF;
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
