-- Manager/owner quote line-item revision support.
-- Approved invoices remain immutable; this RPC only revises draft/awaiting-approval estimates.

create or replace function public.chillbros_manager_replace_estimate_lines(
  p_invoice_id uuid,
  p_notes text,
  p_line_items jsonb
)
returns void
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
  v_down_payment_amount numeric := 0;
begin
  if jsonb_typeof(p_line_items) <> 'array' then
    raise exception 'line items must be an array' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_line_items);
  if v_count < 1 or v_count > 20 then
    raise exception 'invalid line item count' using errcode = '22023';
  end if;
  if p_notes is not null and length(p_notes) > 2000 then
    raise exception 'notes are too long' using errcode = '22023';
  end if;

  select * into v_invoice
  from public.chillbros_invoices
  where id = p_invoice_id
    and revoked_at is null
    and status in ('draft','awaiting_approval')
  for update;

  if not found then
    raise exception 'estimate is not editable' using errcode = 'P0001';
  end if;

  select coalesce(tax_exempt, false)
  into v_customer_tax_exempt
  from public.chillbros_customers
  where id = v_invoice.customer_id;

  for v_index in 0..v_count - 1 loop
    v_item := p_line_items -> v_index;
    v_label := btrim(v_item ->> 'label');
    v_description := nullif(btrim(coalesce(v_item ->> 'description', '')), '');
    v_quantity := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 1);
    v_unit_price := coalesce(nullif(v_item ->> 'unit_price', '')::numeric, 0);
    v_taxable := coalesce(nullif(v_item ->> 'taxable', '')::boolean, false);
    v_amount := round(v_quantity * v_unit_price, 2);

    if v_label is null or length(v_label) < 1 or length(v_label) > 200
      or (v_description is not null and length(v_description) > 1000)
      or v_quantity <= 0 or v_quantity > 1000
      or v_unit_price < 0 or v_unit_price > 100000 then
      raise exception 'invalid line item' using errcode = '22023';
    end if;

    v_subtotal := v_subtotal + v_amount;
    if v_taxable then v_taxable_subtotal := v_taxable_subtotal + v_amount; end if;
  end loop;

  if v_subtotal <= 0 or v_subtotal > 250000 then
    raise exception 'invalid estimate total' using errcode = '22023';
  end if;

  if v_invoice.discount_type = 'percent' then
    v_discount_amount := round(v_subtotal * least(v_invoice.discount_value, 100) / 100, 2);
  elsif v_invoice.discount_type = 'dollar' then
    v_discount_amount := least(v_invoice.discount_value, v_subtotal);
  end if;

  if v_customer_tax_exempt then
    v_invoice.tax_rate := 0;
  end if;
  if v_subtotal > 0 then
    v_taxable_after_discount := greatest(v_taxable_subtotal - round(v_discount_amount * (v_taxable_subtotal / v_subtotal), 2), 0);
  end if;
  v_tax_amount := round(v_taxable_after_discount * coalesce(v_invoice.tax_rate, 0) / 100, 2);
  v_total := greatest(v_subtotal - v_discount_amount, 0) + v_tax_amount;

  if v_invoice.down_payment_type = 'percent' then
    v_down_payment_amount := round(v_total * least(v_invoice.down_payment_value, 100) / 100, 2);
  elsif v_invoice.down_payment_type = 'dollar' then
    v_down_payment_amount := least(v_invoice.down_payment_value, v_total);
  end if;

  delete from public.chillbros_invoice_line_items where invoice_id = p_invoice_id;

  for v_index in 0..v_count - 1 loop
    v_item := p_line_items -> v_index;
    v_label := btrim(v_item ->> 'label');
    v_description := nullif(btrim(coalesce(v_item ->> 'description', '')), '');
    v_quantity := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 1);
    v_unit_price := coalesce(nullif(v_item ->> 'unit_price', '')::numeric, 0);
    v_taxable := coalesce(nullif(v_item ->> 'taxable', '')::boolean, false);
    v_amount := round(v_quantity * v_unit_price, 2);

    insert into public.chillbros_invoice_line_items(
      invoice_id, label, description, quantity, unit_price, amount, sort_order, taxable
    ) values (
      p_invoice_id, v_label, v_description, v_quantity, v_unit_price, v_amount, v_index, v_taxable
    );
  end loop;

  update public.chillbros_invoices
  set notes = nullif(btrim(coalesce(p_notes, '')), ''),
      discount_amount = round(v_discount_amount, 2),
      taxable_subtotal = round(v_taxable_subtotal, 2),
      tax_rate = coalesce(v_invoice.tax_rate, 0),
      tax_amount = round(v_tax_amount, 2),
      down_payment_amount = round(v_down_payment_amount, 2),
      updated_at = now()
  where id = p_invoice_id;
end;
$$;

revoke all on function public.chillbros_manager_replace_estimate_lines(uuid,text,jsonb)
from public, anon, authenticated;
grant execute on function public.chillbros_manager_replace_estimate_lines(uuid,text,jsonb)
to service_role;
