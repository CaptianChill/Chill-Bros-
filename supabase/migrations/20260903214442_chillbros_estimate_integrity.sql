-- Keep estimate creation and payment state consistent for the launch workflow.

create unique index if not exists chillbros_invoices_one_active_per_job_idx
  on public.chillbros_invoices (job_id)
  where job_id is not null and status <> 'void';

alter table public.chillbros_invoices
  add column revoked_at timestamptz,
  add column revoked_by uuid,
  add column paid_recorded_by uuid,
  add constraint chillbros_invoices_revoked_by_fkey
    foreign key (revoked_by) references public.chillbros_profiles(id),
  add constraint chillbros_invoices_paid_recorded_by_fkey
    foreign key (paid_recorded_by) references public.chillbros_profiles(id);

create index chillbros_invoices_revoked_by_idx
  on public.chillbros_invoices (revoked_by);
create index chillbros_invoices_paid_recorded_by_idx
  on public.chillbros_invoices (paid_recorded_by);

alter table public.chillbros_invoice_line_items
  add constraint chillbros_invoice_line_items_nonnegative_amount
  check (amount >= 0 and amount <= 100000),
  add constraint chillbros_invoice_line_items_valid_label
  check (length(btrim(label)) between 1 and 200),
  add constraint chillbros_invoice_line_items_valid_sort_order
  check (sort_order between 0 and 9);

alter table public.chillbros_invoices
  add constraint chillbros_invoices_approval_has_signature
  check (
    status <> 'approved'
    or (signature_name is not null and length(btrim(signature_name)) >= 2 and signed_at is not null)
  );

alter table public.chillbros_invoices
  add constraint chillbros_invoices_paid_has_timestamp
  check (payment_status <> 'paid' or (paid_at is not null and paid_recorded_by is not null)),
  add constraint chillbros_invoices_void_has_audit
  check (status <> 'void' or revoked_at is not null),
  add constraint chillbros_invoices_valid_notes
  check (notes is null or length(notes) <= 2000);

-- A single RPC keeps the invoice and its line items in one transaction.
-- SECURITY INVOKER plus service-role-only EXECUTE preserves the app's
-- server-side authorization boundary.
create or replace function public.chillbros_create_estimate(
  p_job_id uuid,
  p_invoice_number text,
  p_notes text,
  p_line_items jsonb
)
returns table (
  estimate_id uuid,
  estimate_number text,
  estimate_token uuid
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_customer_id uuid;
  v_invoice_id uuid;
  v_portal_token uuid;
  v_item jsonb;
  v_label text;
  v_amount numeric;
  v_total numeric := 0;
  v_item_count integer;
  v_index integer;
begin
  if jsonb_typeof(p_line_items) <> 'array' then
    raise exception 'line items must be an array' using errcode = '22023';
  end if;

  v_item_count := jsonb_array_length(p_line_items);
  if v_item_count < 1 or v_item_count > 10 then
    raise exception 'invalid line item count' using errcode = '22023';
  end if;
  if p_notes is not null and length(p_notes) > 2000 then
    raise exception 'notes are too long' using errcode = '22023';
  end if;

  for v_index in 0..v_item_count - 1 loop
    v_item := p_line_items -> v_index;
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'amount') <> 'number' then
      raise exception 'invalid line item' using errcode = '22023';
    end if;
    v_label := btrim(v_item ->> 'label');
    v_amount := (v_item ->> 'amount')::numeric;
    if v_label is null or length(v_label) < 1 or length(v_label) > 200 or v_amount < 0 or v_amount > 100000 then
      raise exception 'invalid line item' using errcode = '22023';
    end if;
    v_total := v_total + v_amount;
  end loop;

  if v_total <= 0 or v_total > 250000 then
    raise exception 'invalid estimate total' using errcode = '22023';
  end if;

  select jobs.customer_id
  into v_customer_id
  from public.chillbros_jobs as jobs
  where jobs.id = p_job_id
    and jobs.status in ('scheduled', 'in_progress')
  for update;

  if not found then
    raise exception 'job is not available' using errcode = 'P0001';
  end if;

  insert into public.chillbros_invoices (
    invoice_number,
    job_id,
    customer_id,
    status,
    notes
  )
  values (
    p_invoice_number,
    p_job_id,
    v_customer_id,
    'awaiting_approval',
    nullif(p_notes, '')
  )
  returning chillbros_invoices.id, chillbros_invoices.portal_token
  into v_invoice_id, v_portal_token;

  for v_index in 0..v_item_count - 1 loop
    v_item := p_line_items -> v_index;
    insert into public.chillbros_invoice_line_items (
      invoice_id,
      label,
      amount,
      sort_order
    )
    values (
      v_invoice_id,
      btrim(v_item ->> 'label'),
      (v_item ->> 'amount')::numeric,
      v_index
    );
  end loop;

  return query
    select v_invoice_id, p_invoice_number, v_portal_token;
end;
$function$;

revoke all on function public.chillbros_create_estimate(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.chillbros_create_estimate(uuid, text, text, jsonb)
  to service_role;
