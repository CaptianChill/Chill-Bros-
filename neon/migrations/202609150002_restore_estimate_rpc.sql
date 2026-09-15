-- Restore estimate publication after the Supabase-to-Neon cutover.
-- The browser's Neon Auth JWT reaches this RPC through the Neon Data API.
CREATE OR REPLACE FUNCTION public.chillbros_create_estimate_v2(
  p_job_id uuid,
  p_invoice_number text,
  p_notes text,
  p_line_items jsonb,
  p_adjustments jsonb
)
RETURNS TABLE(estimate_id uuid, estimate_number text, estimate_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_auth_user_id uuid;
  v_profile_id uuid;
  v_profile_role text;
  v_customer_id uuid;
  v_customer_tax_exempt boolean := false;
  v_invoice_id uuid;
  v_invoice_number text;
  v_portal_token uuid;
  v_item jsonb;
  v_label text;
  v_description text;
  v_taxable boolean;
  v_quantity numeric;
  v_unit_price numeric;
  v_amount numeric;
  v_subtotal numeric := 0;
  v_taxable_subtotal numeric := 0;
  v_item_count integer;
  v_index integer;
  v_discount_type text;
  v_discount_value numeric := 0;
  v_discount_amount numeric := 0;
  v_down_type text;
  v_down_value numeric := 0;
  v_down_amount numeric := 0;
  v_tax_rate numeric := 0;
  v_tax_amount numeric := 0;
  v_taxable_after_discount numeric := 0;
  v_after_discount numeric;
  v_total numeric;
BEGIN
  v_auth_user_id := public.chillbros_current_auth_uid();
  SELECT p.id, p.role::text
    INTO v_profile_id, v_profile_role
  FROM public.chillbros_profiles p
  WHERE p.auth_user_id = v_auth_user_id
    AND p.status::text = 'active'
  LIMIT 1;

  IF NOT FOUND OR v_profile_role NOT IN ('manager', 'technician') THEN
    RAISE EXCEPTION 'active field-service account required' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_line_items) <> 'array' THEN
    RAISE EXCEPTION 'line items must be an array' USING ERRCODE = '22023';
  END IF;
  v_item_count := jsonb_array_length(p_line_items);
  IF v_item_count < 1 OR v_item_count > 20 THEN
    RAISE EXCEPTION 'invalid line item count' USING ERRCODE = '22023';
  END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN
    RAISE EXCEPTION 'notes are too long' USING ERRCODE = '22023';
  END IF;

  FOR v_index IN 0..v_item_count - 1 LOOP
    v_item := p_line_items -> v_index;
    v_label := btrim(v_item ->> 'label');
    v_description := nullif(btrim(coalesce(v_item ->> 'description', '')), '');
    v_quantity := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 1);
    v_unit_price := coalesce(nullif(v_item ->> 'unit_price', '')::numeric, nullif(v_item ->> 'amount', '')::numeric, 0);
    v_taxable := coalesce(nullif(v_item ->> 'taxable', '')::boolean, false);
    v_amount := round(v_quantity * v_unit_price, 2);
    IF v_label IS NULL
      OR length(v_label) < 1
      OR length(v_label) > 200
      OR (v_description IS NOT NULL AND length(v_description) > 1000)
      OR v_quantity <= 0
      OR v_quantity > 1000
      OR v_unit_price < 0
      OR v_unit_price > 100000
      OR v_amount > 100000
    THEN
      RAISE EXCEPTION 'invalid line item' USING ERRCODE = '22023';
    END IF;
    v_subtotal := v_subtotal + v_amount;
    IF v_taxable THEN
      v_taxable_subtotal := v_taxable_subtotal + v_amount;
    END IF;
  END LOOP;
  IF v_subtotal <= 0 OR v_subtotal > 250000 THEN
    RAISE EXCEPTION 'invalid estimate total' USING ERRCODE = '22023';
  END IF;

  v_discount_type := nullif(p_adjustments ->> 'discount_type', '');
  v_discount_value := coalesce(nullif(p_adjustments ->> 'discount_value', '')::numeric, 0);
  IF v_discount_type IS NOT NULL AND v_discount_type NOT IN ('percent', 'dollar') THEN
    RAISE EXCEPTION 'invalid discount type' USING ERRCODE = '22023';
  END IF;
  IF v_discount_value < 0 OR (v_discount_type = 'dollar' AND v_discount_value > 250000) THEN
    RAISE EXCEPTION 'invalid discount' USING ERRCODE = '22023';
  END IF;
  IF v_discount_type = 'percent' THEN
    IF v_discount_value > 100 THEN
      RAISE EXCEPTION 'discount percent cannot exceed 100' USING ERRCODE = '22023';
    END IF;
    v_discount_amount := round(v_subtotal * v_discount_value / 100, 2);
  ELSIF v_discount_type = 'dollar' THEN
    v_discount_amount := least(v_discount_value, v_subtotal);
  END IF;
  v_after_discount := greatest(v_subtotal - v_discount_amount, 0);

  v_tax_rate := coalesce(nullif(p_adjustments ->> 'tax_rate', '')::numeric, 0);
  IF v_tax_rate < 0 OR v_tax_rate > 25 THEN
    RAISE EXCEPTION 'invalid tax rate' USING ERRCODE = '22023';
  END IF;

  SELECT j.customer_id, coalesce(c.tax_exempt, false)
    INTO v_customer_id, v_customer_tax_exempt
  FROM public.chillbros_jobs j
  JOIN public.chillbros_customers c ON c.id = j.customer_id
  WHERE j.id = p_job_id
    AND j.archived_at IS NULL
    AND j.status::text IN ('scheduled', 'in_progress')
    AND (
      v_profile_role = 'manager'
      OR (v_profile_role = 'technician' AND j.assigned_tech_id = v_profile_id)
    )
  FOR UPDATE OF j;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job is not available to this staff account' USING ERRCODE = '42501';
  END IF;

  IF v_customer_tax_exempt THEN
    v_tax_rate := 0;
  END IF;
  IF v_subtotal > 0 THEN
    v_taxable_after_discount := greatest(
      v_taxable_subtotal - round(v_discount_amount * (v_taxable_subtotal / v_subtotal), 2),
      0
    );
  END IF;
  v_tax_amount := round(v_taxable_after_discount * v_tax_rate / 100, 2);
  v_total := v_after_discount + v_tax_amount;

  v_down_type := nullif(p_adjustments ->> 'down_payment_type', '');
  v_down_value := coalesce(nullif(p_adjustments ->> 'down_payment_value', '')::numeric, 0);
  IF v_down_type IS NOT NULL AND v_down_type NOT IN ('percent', 'dollar') THEN
    RAISE EXCEPTION 'invalid down payment type' USING ERRCODE = '22023';
  END IF;
  IF v_down_value < 0 OR (v_down_type = 'dollar' AND v_down_value > 250000) THEN
    RAISE EXCEPTION 'invalid down payment' USING ERRCODE = '22023';
  END IF;
  IF v_down_type = 'percent' THEN
    IF v_down_value > 100 THEN
      RAISE EXCEPTION 'down payment percent cannot exceed 100' USING ERRCODE = '22023';
    END IF;
    v_down_amount := round(v_total * v_down_value / 100, 2);
  ELSIF v_down_type = 'dollar' THEN
    v_down_amount := least(v_down_value, v_total);
  END IF;

  -- The application passes an E-PENDING marker. Neon has no insert trigger,
  -- so allocate the final collision-safe number here.
  v_invoice_number := public.chillbros_next_document_number('estimate');

  INSERT INTO public.chillbros_invoices(
    invoice_number,
    job_id,
    customer_id,
    status,
    notes,
    discount_type,
    discount_value,
    discount_amount,
    down_payment_type,
    down_payment_value,
    down_payment_amount,
    tax_rate,
    taxable_subtotal,
    tax_amount,
    payment_terms
  )
  VALUES(
    v_invoice_number,
    p_job_id,
    v_customer_id,
    'awaiting_approval',
    nullif(p_notes, ''),
    v_discount_type,
    v_discount_value,
    v_discount_amount,
    v_down_type,
    v_down_value,
    v_down_amount,
    v_tax_rate,
    v_taxable_subtotal,
    v_tax_amount,
    'due_on_receipt'
  )
  RETURNING id, portal_token INTO v_invoice_id, v_portal_token;

  FOR v_index IN 0..v_item_count - 1 LOOP
    v_item := p_line_items -> v_index;
    v_label := btrim(v_item ->> 'label');
    v_description := nullif(btrim(coalesce(v_item ->> 'description', '')), '');
    v_quantity := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 1);
    v_unit_price := coalesce(nullif(v_item ->> 'unit_price', '')::numeric, nullif(v_item ->> 'amount', '')::numeric, 0);
    v_taxable := coalesce(nullif(v_item ->> 'taxable', '')::boolean, false);
    v_amount := round(v_quantity * v_unit_price, 2);
    INSERT INTO public.chillbros_invoice_line_items(
      invoice_id,
      label,
      description,
      quantity,
      unit_price,
      amount,
      sort_order,
      taxable
    )
    VALUES(
      v_invoice_id,
      v_label,
      v_description,
      v_quantity,
      v_unit_price,
      v_amount,
      v_index,
      v_taxable
    );
  END LOOP;

  INSERT INTO public.chillbros_workflow_events(job_id, invoice_id, actor_id, stage, message)
  VALUES(
    p_job_id,
    v_invoice_id,
    v_profile_id,
    'awaiting_approval',
    'Estimate published and awaiting customer approval.'
  );

  RETURN QUERY SELECT v_invoice_id, v_invoice_number, v_portal_token;
END
$$;

REVOKE ALL ON FUNCTION public.chillbros_create_estimate_v2(uuid, text, text, jsonb, jsonb)
  FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION public.chillbros_create_estimate_v2(uuid, text, text, jsonb, jsonb)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
