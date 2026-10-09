-- Owner/office can edit ANY unpaid quote or invoice in place (lines, notes,
-- down payment) without reopening it, so a ready-to-pay invoice stays
-- ready-to-pay. Paid invoices stay locked (use credits/refunds).
--
-- Also fixes two payment-path problems found in the 2026-10-09 audit:
--  1. chillbros_invoices_paid_has_timestamp required paid_recorded_by on every
--     paid invoice, so an automatic Square card payment (no staff member)
--     could never be marked paid — the webhook update was rejected.
--  2. Line items were capped at 20 rows; raised to 40 so parts + equipment fit.

alter table public.chillbros_invoices
  drop constraint if exists chillbros_invoices_paid_has_timestamp;
alter table public.chillbros_invoices
  add constraint chillbros_invoices_paid_has_timestamp
  check (
    payment_status <> 'paid'::public.chillbros_payment_status
    or (paid_at is not null and (paid_recorded_by is not null or payment_method = 'card'::public.chillbros_payment_method))
  );

alter table public.chillbros_invoice_line_items
  drop constraint if exists chillbros_invoice_line_items_valid_sort_order;
alter table public.chillbros_invoice_line_items
  add constraint chillbros_invoice_line_items_valid_sort_order
  check (sort_order between 0 and 39);

create or replace function public.chillbros_owner_revise_unpaid_document(
  p_invoice_id uuid,
  p_notes text,
  p_line_items jsonb,
  p_down_payment_type text,
  p_down_payment_value numeric
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_invoice public.chillbros_invoices%rowtype;
  v_customer_tax_exempt boolean := false;
  v_item jsonb;
  v_index integer;
  v_count integer;
  v_label text;
  v_description text;
  v_quantity numeric;
  v_unit_price numeric;
  v_amount numeric;
  v_taxable boolean;
  v_subtotal numeric := 0;
  v_taxable_subtotal numeric := 0;
  v_discount_amount numeric := 0;
  v_taxable_after_discount numeric := 0;
  v_tax_amount numeric := 0;
  v_total numeric := 0;
  v_old_total numeric := 0;
  v_credits numeric := 0;
  v_dp_type text;
  v_dp_value numeric := 0;
  v_dp_amount numeric := 0;
begin
  if jsonb_typeof(p_line_items) <> 'array' then
    raise exception 'line items must be an array' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_line_items);
  if v_count < 1 or v_count > 40 then
    raise exception 'Add between 1 and 40 line items.' using errcode = '22023';
  end if;
  if p_notes is not null and length(p_notes) > 2000 then
    raise exception 'Customer notes must be 2,000 characters or fewer.' using errcode = '22023';
  end if;

  select * into v_invoice
  from public.chillbros_invoices
  where id = p_invoice_id
  for update;

  if not found or v_invoice.revoked_at is not null or v_invoice.status = 'void' then
    raise exception 'This document is not active.' using errcode = 'P0001';
  end if;
  if v_invoice.converted_invoice_id is not null then
    raise exception 'This quote was converted. Edit the invoice instead.' using errcode = 'P0001';
  end if;
  if v_invoice.payment_status = 'paid' then
    raise exception 'Paid invoices are locked. Use a credit or refund.' using errcode = 'P0001';
  end if;

  select coalesce(sum(l.amount), 0) into v_old_total
  from public.chillbros_invoice_line_items l where l.invoice_id = p_invoice_id;
  v_old_total := greatest(v_old_total - coalesce(v_invoice.discount_amount, 0), 0) + coalesce(v_invoice.tax_amount, 0);

  select coalesce(sum(a.amount), 0) into v_credits
  from public.chillbros_invoice_adjustments a
  where a.invoice_id = p_invoice_id and a.adjustment_type = 'credit';

  select coalesce(tax_exempt, false) into v_customer_tax_exempt
  from public.chillbros_customers where id = v_invoice.customer_id;

  for v_index in 0..v_count - 1 loop
    v_item := p_line_items -> v_index;
    v_label := btrim(coalesce(v_item ->> 'label', ''));
    v_description := nullif(btrim(coalesce(v_item ->> 'description', '')), '');
    v_quantity := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 1);
    v_unit_price := coalesce(nullif(v_item ->> 'unit_price', '')::numeric, 0);
    v_amount := round(v_quantity * v_unit_price, 2);
    if length(v_label) < 1 or length(v_label) > 200
      or (v_description is not null and length(v_description) > 1000)
      or v_quantity <= 0 or v_quantity > 1000
      or v_unit_price < 0 or v_unit_price > 100000 or v_amount > 100000 then
      raise exception 'Check line % — name, quantity, and price.', v_index + 1 using errcode = '22023';
    end if;
    v_subtotal := v_subtotal + v_amount;
    if coalesce(nullif(v_item ->> 'taxable', '')::boolean, false) then
      v_taxable_subtotal := v_taxable_subtotal + v_amount;
    end if;
  end loop;

  if v_subtotal <= 0 or v_subtotal > 250000 then
    raise exception 'Total must be between $0.01 and $250,000.' using errcode = '22023';
  end if;

  if v_invoice.discount_type = 'percent' then
    v_discount_amount := round(v_subtotal * least(v_invoice.discount_value, 100) / 100, 2);
  elsif v_invoice.discount_type = 'dollar' then
    v_discount_amount := least(v_invoice.discount_value, v_subtotal);
  end if;
  if v_customer_tax_exempt then v_invoice.tax_rate := 0; end if;
  v_taxable_after_discount := greatest(v_taxable_subtotal - round(v_discount_amount * (v_taxable_subtotal / v_subtotal), 2), 0);
  v_tax_amount := round(v_taxable_after_discount * coalesce(v_invoice.tax_rate, 0) / 100, 2);
  v_total := greatest(v_subtotal - v_discount_amount, 0) + v_tax_amount;

  if v_invoice.down_payment_status = 'paid' then
    -- Money already received: keep it exactly as recorded.
    v_dp_type := v_invoice.down_payment_type;
    v_dp_value := v_invoice.down_payment_value;
    v_dp_amount := v_invoice.down_payment_amount;
    if greatest(v_total - v_credits, 0) < v_dp_amount then
      raise exception 'The new total ($%) is less than the $% down payment already received. Record a refund instead.', round(greatest(v_total - v_credits, 0), 2), v_dp_amount using errcode = '22023';
    end if;
  else
    v_dp_type := nullif(btrim(coalesce(p_down_payment_type, '')), '');
    v_dp_value := coalesce(p_down_payment_value, 0);
    if v_dp_type is not null and v_dp_type not in ('percent', 'dollar') then
      raise exception 'Choose a valid down payment type.' using errcode = '22023';
    end if;
    if v_dp_value < 0 or (v_dp_type = 'percent' and v_dp_value > 100) or v_dp_value > 250000 then
      raise exception 'Check the down payment amount.' using errcode = '22023';
    end if;
    if v_dp_type is null then
      v_dp_value := 0;
      v_dp_amount := 0;
    elsif v_dp_type = 'percent' then
      v_dp_amount := round(v_total * v_dp_value / 100, 2);
    else
      v_dp_amount := round(least(v_dp_value, v_total), 2);
    end if;
  end if;

  delete from public.chillbros_invoice_line_items where invoice_id = p_invoice_id;
  for v_index in 0..v_count - 1 loop
    v_item := p_line_items -> v_index;
    v_quantity := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 1);
    v_unit_price := coalesce(nullif(v_item ->> 'unit_price', '')::numeric, 0);
    insert into public.chillbros_invoice_line_items(invoice_id, label, description, quantity, unit_price, amount, sort_order, taxable)
    values (
      p_invoice_id,
      btrim(v_item ->> 'label'),
      nullif(btrim(coalesce(v_item ->> 'description', '')), ''),
      v_quantity,
      v_unit_price,
      round(v_quantity * v_unit_price, 2),
      v_index,
      coalesce(nullif(v_item ->> 'taxable', '')::boolean, false)
    );
  end loop;

  update public.chillbros_invoices
  set notes = nullif(btrim(coalesce(p_notes, '')), ''),
      discount_amount = round(v_discount_amount, 2),
      taxable_subtotal = round(v_taxable_subtotal, 2),
      tax_rate = coalesce(v_invoice.tax_rate, 0),
      tax_amount = round(v_tax_amount, 2),
      down_payment_type = v_dp_type,
      down_payment_value = round(v_dp_value, 2),
      down_payment_amount = round(v_dp_amount, 2),
      updated_at = now()
  where id = p_invoice_id;

  -- A saved "approved" PDF would now show old prices; it is rebuilt by the app.
  if v_invoice.status = 'approved' then
    delete from public.chillbros_document_archives where invoice_id = p_invoice_id and stage = 'approved';
  end if;

  return jsonb_build_object(
    'status', v_invoice.status,
    'old_total', round(v_old_total, 2),
    'new_total', round(v_total, 2),
    'down_payment_amount', round(v_dp_amount, 2),
    'down_payment_paid', v_invoice.down_payment_status = 'paid'
  );
end;
$$;

revoke all on function public.chillbros_owner_revise_unpaid_document(uuid, text, jsonb, text, numeric)
  from public, anon, authenticated;
grant execute on function public.chillbros_owner_revise_unpaid_document(uuid, text, jsonb, text, numeric)
  to service_role;
