-- Align the Neon schema with the workflow states used by the application.
-- All enum changes are additive so existing jobs and invoices remain untouched.
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'new';
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'needs_scheduling';
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'dispatched';
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'en_route';
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'arrived';
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'diagnosing';
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'awaiting_approval';
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'parts_required';
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'return_visit_needed';
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'repairing';
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'work_complete';
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'ready_to_invoice';
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'invoice_sent';
ALTER TYPE public.chillbros_job_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE public.chillbros_payment_method ADD VALUE IF NOT EXISTS 'cash';
ALTER TYPE public.chillbros_payment_method ADD VALUE IF NOT EXISTS 'check';
ALTER TYPE public.chillbros_payment_method ADD VALUE IF NOT EXISTS 'ach';

-- Codify the Auth link already used by the live Neon database.
ALTER TABLE public.chillbros_profiles
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS chillbros_profiles_auth_user_id_key
  ON public.chillbros_profiles (auth_user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chillbros_profiles_auth_user_id_fkey'
      AND conrelid = 'public.chillbros_profiles'::regclass
  ) THEN
    ALTER TABLE public.chillbros_profiles
      ADD CONSTRAINT chillbros_profiles_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES neon_auth."user"(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- Neon owns the auth schema, so authenticated Data API sessions cannot call
-- auth.uid() directly. This narrow SECURITY DEFINER wrapper only exposes the
-- caller's current JWT subject and keeps all other auth objects private.
CREATE OR REPLACE FUNCTION public.chillbros_current_auth_uid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$ SELECT auth.uid() $$;

REVOKE ALL ON FUNCTION public.chillbros_current_auth_uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chillbros_current_auth_uid() TO authenticated;

-- Staff-scoped, cross-device form drafts. Each Data API request carries the
-- current Neon Auth JWT; RLS prevents one employee from reading another's draft.
CREATE TABLE IF NOT EXISTS public.chillbros_staff_drafts (
  owner_auth_user_id uuid NOT NULL DEFAULT public.chillbros_current_auth_uid()
    REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  owner_profile_id uuid NOT NULL
    REFERENCES public.chillbros_profiles(id) ON DELETE CASCADE,
  draft_key text NOT NULL CHECK (char_length(draft_key) BETWEEN 1 AND 500),
  path text NOT NULL CHECK (char_length(path) BETWEEN 1 AND 1000 AND path LIKE '/%'),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  customer_id uuid REFERENCES public.chillbros_customers(id) ON DELETE SET NULL,
  form_index integer NOT NULL CHECK (form_index BETWEEN 0 AND 1000),
  fields jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fields) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_auth_user_id, draft_key)
);

CREATE INDEX IF NOT EXISTS chillbros_staff_drafts_profile_updated_idx
  ON public.chillbros_staff_drafts (owner_profile_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS chillbros_staff_drafts_customer_updated_idx
  ON public.chillbros_staff_drafts (owner_auth_user_id, customer_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chillbros_staff_drafts TO authenticated;

ALTER TABLE public.chillbros_staff_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chillbros_staff_drafts'
      AND policyname = 'chillbros_staff_drafts_owner'
  ) THEN
    CREATE POLICY chillbros_staff_drafts_owner
      ON public.chillbros_staff_drafts
      FOR ALL
      TO authenticated
      USING (owner_auth_user_id = public.chillbros_current_auth_uid())
      WITH CHECK (owner_auth_user_id = public.chillbros_current_auth_uid());
  END IF;
END
$$;

ALTER POLICY chillbros_staff_drafts_owner
  ON public.chillbros_staff_drafts
  USING (owner_auth_user_id = public.chillbros_current_auth_uid())
  WITH CHECK (owner_auth_user_id = public.chillbros_current_auth_uid());

COMMENT ON TABLE public.chillbros_staff_drafts IS
  'Neon-synchronized form drafts protected per authenticated staff account by RLS.';
