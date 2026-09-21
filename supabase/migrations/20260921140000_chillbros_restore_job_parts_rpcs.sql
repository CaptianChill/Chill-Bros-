-- The Supabase-to-Neon cutover restored chillbros_create_estimate_v2
-- (see neon/migrations/202609150002_restore_estimate_rpc.sql) but never
-- restored chillbros_add_job_part / chillbros_set_job_part_quantity, so
-- every call to add or adjust parts on a job has been failing with
-- "function not found" since the cutover - both the normal field/dispatch
-- parts workflow (lib/chillbros/job-parts.ts) and the owner's direct
-- invoice creation (app/invoices/new/actions.ts).
--
-- Restored here in the current Neon Auth / SECURITY DEFINER convention
-- (see chillbros_create_estimate_v2), not the old service_role grant that
-- no longer applies post-cutover.
--
-- Also adds chillbros_add_job_part_unchecked: parts bought locally for a
-- job are frequently never entered into the tracked catalog stock count,
-- so the owner's direct-invoice flow uses this permissive variant, which
-- records the part usage and clamps stock at zero instead of blocking the
-- invoice. The strict chillbros_add_job_part keeps enforcing stock for the
-- normal field/dispatch workflow, where preventing techs from
-- over-committing shared truck stock across concurrent jobs is the point.

CREATE OR REPLACE FUNCTION public.chillbros_add_job_part(p_job_id uuid, p_part_id uuid, p_quantity integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_profile_id uuid;
  v_profile_role text;
  v_stock integer;
  v_job_part_id uuid;
BEGIN
  IF p_quantity < 1 OR p_quantity > 100 THEN
    RAISE EXCEPTION 'invalid quantity' USING ERRCODE = '22023';
  END IF;

  SELECT p.id, p.role::text INTO v_profile_id, v_profile_role
  FROM public.chillbros_profiles p
  WHERE p.auth_user_id = public.chillbros_current_auth_uid() AND p.status::text = 'active'
  LIMIT 1;
  IF NOT FOUND OR v_profile_role NOT IN ('manager', 'technician') THEN
    RAISE EXCEPTION 'active field-service account required' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.chillbros_jobs j
  WHERE j.id = p_job_id
    AND (
      v_profile_role = 'manager'
      OR (v_profile_role = 'technician' AND j.assigned_tech_id = v_profile_id
          AND j.status::text IN ('scheduled','in_progress','dispatched','en_route','arrived','diagnosing','awaiting_approval','approved','parts_required','return_visit_needed','repairing','work_complete'))
    )
  FOR UPDATE OF j;
  IF NOT FOUND THEN RAISE EXCEPTION 'job not available to this staff account' USING ERRCODE = '42501'; END IF;

  SELECT stock INTO v_stock FROM public.chillbros_parts_catalog WHERE id = p_part_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'part not found' USING ERRCODE = 'P0001'; END IF;
  IF v_stock < p_quantity THEN RAISE EXCEPTION 'insufficient stock' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO public.chillbros_job_parts(job_id, part_id, quantity) VALUES (p_job_id, p_part_id, p_quantity)
  ON CONFLICT (job_id, part_id) DO UPDATE SET quantity = public.chillbros_job_parts.quantity + excluded.quantity
  RETURNING id INTO v_job_part_id;
  UPDATE public.chillbros_parts_catalog SET stock = stock - p_quantity, updated_at = now() WHERE id = p_part_id;
  RETURN v_job_part_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.chillbros_add_job_part_unchecked(p_job_id uuid, p_part_id uuid, p_quantity integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_profile_role text;
  v_job_part_id uuid;
BEGIN
  IF p_quantity < 1 OR p_quantity > 100 THEN
    RAISE EXCEPTION 'invalid quantity' USING ERRCODE = '22023';
  END IF;

  SELECT p.role::text INTO v_profile_role
  FROM public.chillbros_profiles p
  WHERE p.auth_user_id = public.chillbros_current_auth_uid() AND p.status::text = 'active'
  LIMIT 1;
  IF NOT FOUND OR v_profile_role <> 'manager' THEN
    RAISE EXCEPTION 'manager account required' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.chillbros_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job not found' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM public.chillbros_parts_catalog WHERE id = p_part_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'part not found' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO public.chillbros_job_parts(job_id, part_id, quantity) VALUES (p_job_id, p_part_id, p_quantity)
  ON CONFLICT (job_id, part_id) DO UPDATE SET quantity = public.chillbros_job_parts.quantity + excluded.quantity
  RETURNING id INTO v_job_part_id;
  UPDATE public.chillbros_parts_catalog SET stock = greatest(0, stock - p_quantity), updated_at = now() WHERE id = p_part_id;
  RETURN v_job_part_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.chillbros_set_job_part_quantity(p_job_part_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_profile_id uuid;
  v_profile_role text;
  v_part_id uuid;
  v_old_quantity integer;
  v_delta integer;
  v_stock integer;
  v_job_id uuid;
  v_assigned_tech_id uuid;
  v_job_status text;
BEGIN
  IF p_quantity < 0 OR p_quantity > 1000 THEN
    RAISE EXCEPTION 'invalid quantity' USING ERRCODE = '22023';
  END IF;

  SELECT p.id, p.role::text INTO v_profile_id, v_profile_role
  FROM public.chillbros_profiles p
  WHERE p.auth_user_id = public.chillbros_current_auth_uid() AND p.status::text = 'active'
  LIMIT 1;
  IF NOT FOUND OR v_profile_role NOT IN ('manager', 'technician') THEN
    RAISE EXCEPTION 'active field-service account required' USING ERRCODE = '42501';
  END IF;

  SELECT jp.part_id, jp.quantity, jp.job_id INTO v_part_id, v_old_quantity, v_job_id
  FROM public.chillbros_job_parts jp WHERE jp.id = p_job_part_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job part not found' USING ERRCODE = 'P0001'; END IF;

  SELECT j.assigned_tech_id, j.status::text INTO v_assigned_tech_id, v_job_status
  FROM public.chillbros_jobs j WHERE j.id = v_job_id FOR UPDATE;
  IF v_profile_role = 'technician' AND (
    v_assigned_tech_id IS DISTINCT FROM v_profile_id
    OR v_job_status NOT IN ('scheduled','in_progress','dispatched','en_route','arrived','diagnosing','awaiting_approval','approved','parts_required','return_visit_needed','repairing','work_complete')
  ) THEN
    RAISE EXCEPTION 'job not available to this staff account' USING ERRCODE = '42501';
  END IF;

  SELECT stock INTO v_stock FROM public.chillbros_parts_catalog WHERE id = v_part_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'part not found' USING ERRCODE = 'P0001'; END IF;
  v_delta := p_quantity - v_old_quantity;
  IF v_delta > 0 AND v_stock < v_delta THEN RAISE EXCEPTION 'insufficient stock' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.chillbros_parts_catalog SET stock = stock - v_delta, updated_at = now() WHERE id = v_part_id;
  IF p_quantity = 0 THEN DELETE FROM public.chillbros_job_parts WHERE id = p_job_part_id;
  ELSE UPDATE public.chillbros_job_parts SET quantity = p_quantity WHERE id = p_job_part_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.chillbros_add_job_part(uuid,uuid,integer) FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION public.chillbros_add_job_part(uuid,uuid,integer) TO authenticated;

REVOKE ALL ON FUNCTION public.chillbros_add_job_part_unchecked(uuid,uuid,integer) FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION public.chillbros_add_job_part_unchecked(uuid,uuid,integer) TO authenticated;

REVOKE ALL ON FUNCTION public.chillbros_set_job_part_quantity(uuid,integer) FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION public.chillbros_set_job_part_quantity(uuid,integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
