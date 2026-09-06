-- Complete billing center without introducing a partial-payment ledger.
-- Adds tax controls, terms/aging, immutable PDF archives, receipts,
-- audited credits/refunds, delivery logs, and reminder state.

alter table public.chillbros_customers
  add column if not exists tax_exempt boolean not null default false,
  add column if not exists tax_exempt_note text;

alter table public.chillbros_customers
  drop constraint if exists chillbros_customers_tax_exempt_note_len;
alter table public.chillbros_customers
  add constraint chillbros_customers_tax_exempt_note_len
  check (tax_exempt_note is null or length(tax_exempt_note) <= 500);

alter table public.chillbros_invoice_line_items
  add column if not exists taxable boolean not null default false;

alter table public.chillbros_invoice_line_items
  drop constraint if exists chillbros_invoice_line_items_valid_sort_order;
alter table public.chillbros_invoice_line_items
  add constraint chillbros_invoice_line_items_valid_sort_order
  check (sort_order between 0 and 19);

alter table public.chillbros_invoices
  add column if not exists tax_rate numeric(6,3) not null default 0,
  add column if not exists taxable_subtotal numeric(12,2) not null default 0,
  add column if not exists tax_amount numeric(12,2) not null default 0,
  add column if not exists issued_at timestamptz,
  add column if not exists payment_terms text not null default 'due_on_receipt',
  add column if not exists due_at timestamptz,
  add column if not exists last_reminder_at timestamptz,
  add column if not exists reminder_count integer not null default 0;

alter table public.chillbros_invoices
  drop constraint if exists chillbros_invoices_valid_tax_rate,
  drop constraint if exists chillbros_invoices_valid_taxable_subtotal,
  drop constraint if exists chillbros_invoices_valid_tax_amount,
  drop constraint if exists chillbros_invoices_valid_payment_terms,
  drop constraint if exists chillbros_invoices_valid_reminder_count;

alter table public.chillbros_invoices
  add constraint chillbros_invoices_valid_tax_rate check (tax_rate >= 0 and tax_rate <= 25),
  add constraint chillbros_invoices_valid_taxable_subtotal check (taxable_subtotal >= 0 and taxable_subtotal <= 250000),
  add constraint chillbros_invoices_valid_tax_amount check (tax_amount >= 0 and tax_amount <= 100000),
  add constraint chillbros_invoices_valid_payment_terms check (payment_terms in ('due_on_receipt','net_7','net_15','net_30','custom')),
  add constraint chillbros_invoices_valid_reminder_count check (reminder_count >= 0 and reminder_count <= 1000);

update public.chillbros_invoices
set issued_at = coalesce(issued_at, signed_at, updated_at),
    due_at = coalesce(due_at, signed_at, updated_at)
where status = 'approved' and issued_at is null;

create index if not exists chillbros_invoices_due_idx
  on public.chillbros_invoices(payment_status, due_at)
  where status = 'approved' and revoked_at is null;

create table if not exists public.chillbros_invoice_adjustments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.chillbros_invoices(id) on delete cascade,
  adjustment_type text not null,
  amount numeric(12,2) not null,
  reason text not null,
  created_by uuid references public.chillbros_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chillbros_invoice_adjustments_type check (adjustment_type in ('credit','refund')),
  constraint chillbros_invoice_adjustments_amount check (amount > 0 and amount <= 250000),
  constraint chillbros_invoice_adjustments_reason check (length(btrim(reason)) between 2 and 1000)
);
create index if not exists chillbros_invoice_adjustments_invoice_idx
  on public.chillbros_invoice_adjustments(invoice_id, created_at desc);
alter table public.chillbros_invoice_adjustments enable row level security;
revoke all on table public.chillbros_invoice_adjustments from public, anon, authenticated;
grant all on table public.chillbros_invoice_adjustments to service_role;

create table if not exists public.chillbros_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  portal_token uuid not null default gen_random_uuid() unique,
  invoice_id uuid not null unique references public.chillbros_invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_method text,
  paid_at timestamptz not null,
  created_by uuid references public.chillbros_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chillbros_receipts_amount check (amount >= 0 and amount <= 250000)
);
create index if not exists chillbros_receipts_created_idx on public.chillbros_receipts(created_at desc);
alter table public.chillbros_receipts enable row level security;
revoke all on table public.chillbros_receipts from public, anon, authenticated;
grant all on table public.chillbros_receipts to service_role;

create table if not exists public.chillbros_document_archives (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.chillbros_invoices(id) on delete cascade,
  stage text not null,
  mime_type text not null default 'application/pdf',
  pdf_base64 text not null,
  sha256 text not null,
  created_by uuid references public.chillbros_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chillbros_document_archives_stage check (stage in ('approved','paid')),
  constraint chillbros_document_archives_mime check (mime_type = 'application/pdf'),
  constraint chillbros_document_archives_sha check (length(sha256) = 64),
  unique(invoice_id, stage)
);
create index if not exists chillbros_document_archives_invoice_idx
  on public.chillbros_document_archives(invoice_id, created_at desc);
alter table public.chillbros_document_archives enable row level security;
revoke all on table public.chillbros_document_archives from public, anon, authenticated;
grant all on table public.chillbros_document_archives to service_role;

create table if not exists public.chillbros_delivery_log (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.chillbros_invoices(id) on delete cascade,
  channel text not null,
  delivery_type text not null,
  recipient text not null,
  status text not null,
  error text,
  created_at timestamptz not null default now(),
  constraint chillbros_delivery_log_channel check (channel in ('email','sms')),
  constraint chillbros_delivery_log_type check (delivery_type in ('estimate','invoice','reminder','receipt')),
  constraint chillbros_delivery_log_status check (status in ('sent','failed','configuration_required','skipped')),
  constraint chillbros_delivery_log_recipient check (length(recipient) between 1 and 320),
  constraint chillbros_delivery_log_error check (error is null or length(error) <= 1000)
);
create index if not exists chillbros_delivery_log_invoice_idx
  on public.chillbros_delivery_log(invoice_id, created_at desc);
create index if not exists chillbros_delivery_log_created_idx
  on public.chillbros_delivery_log(created_at desc);
alter table public.chillbros_delivery_log enable row level security;
revoke all on table public.chillbros_delivery_log from public, anon, authenticated;
grant all on table public.chillbros_delivery_log to service_role;

-- Same RPC signature as the existing app, now with tax metadata carried in JSON.
create or replace function public.chillbros_create_estimate_v2(p_job_id uuid,p_invoice_number text,p_notes text,p_line_items jsonb,p_adjustments jsonb)
returns table(estimate_id uuid, estimate_number text, estimate_token uuid)
language plpgsql set search_path = '' as $$
declare
  v_customer_id uuid; v_customer_tax_exempt boolean := false; v_invoice_id uuid; v_portal_token uuid;
  v_item jsonb; v_label text; v_description text; v_taxable boolean;
  v_quantity numeric; v_unit_price numeric; v_amount numeric; v_subtotal numeric := 0; v_taxable_subtotal numeric := 0; v_item_count integer; v_index integer;
  v_discount_type text; v_discount_value numeric := 0; v_discount_amount numeric := 0;
  v_down_type text; v_down_value numeric := 0; v_down_amount numeric := 0;
  v_tax_rate numeric := 0; v_tax_amount numeric := 0; v_taxable_after_discount numeric := 0;
  v_after_discount numeric; v_total numeric;
begin
  if jsonb_typeof(p_line_items) <> 'array' then raise exception 'line items must be an array' using errcode='22023'; end if;
  v_item_count := jsonb_array_length(p_line_items);
  if v_item_count < 1 or v_item_count > 20 then raise exception 'invalid line item count' using errcode='22023'; end if;
  if p_notes is not null and length(p_notes) > 2000 then raise exception 'notes are too long' using errcode='22023'; end if;

  for v_index in 0..v_item_count - 1 loop
    v_item := p_line_items -> v_index;
    v_label := btrim(v_item ->> 'label');
    v_description := nullif(btrim(coalesce(v_item ->> 'description','')), '');
    v_quantity := coalesce(nullif(v_item ->> 'quantity','')::numeric, 1);
    v_unit_price := coalesce(nullif(v_item ->> 'unit_price','')::numeric, nullif(v_item ->> 'amount','')::numeric, 0);
    v_taxable := coalesce(nullif(v_item ->> 'taxable','')::boolean, false);
    v_amount := round(v_quantity * v_unit_price, 2);
    if v_label is null or length(v_label) < 1 or length(v_label) > 200 or (v_description is not null and length(v_description) > 1000) or v_quantity <= 0 or v_quantity > 1000 or v_unit_price < 0 or v_unit_price > 100000 then raise exception 'invalid line item' using errcode='22023'; end if;
    v_subtotal := v_subtotal + v_amount;
    if v_taxable then v_taxable_subtotal := v_taxable_subtotal + v_amount; end if;
  end loop;
  if v_subtotal <= 0 or v_subtotal > 250000 then raise exception 'invalid estimate total' using errcode='22023'; end if;

  v_discount_type := nullif(p_adjustments ->> 'discount_type','');
  v_discount_value := coalesce(nullif(p_adjustments ->> 'discount_value','')::numeric,0);
  if v_discount_type is not null and v_discount_type not in ('percent','dollar') then raise exception 'invalid discount type' using errcode='22023'; end if;
  if v_discount_value < 0 then raise exception 'invalid discount' using errcode='22023'; end if;
  if v_discount_type='percent' then
    if v_discount_value > 100 then raise exception 'discount percent cannot exceed 100' using errcode='22023'; end if;
    v_discount_amount:=round(v_subtotal*v_discount_value/100,2);
  elsif v_discount_type='dollar' then v_discount_amount:=least(v_discount_value,v_subtotal); end if;
  v_after_discount:=greatest(v_subtotal-v_discount_amount,0);

  v_tax_rate := coalesce(nullif(p_adjustments ->> 'tax_rate','')::numeric, 0);
  if v_tax_rate < 0 or v_tax_rate > 25 then raise exception 'invalid tax rate' using errcode='22023'; end if;

  select j.customer_id, coalesce(c.tax_exempt,false)
  into v_customer_id, v_customer_tax_exempt
  from public.chillbros_jobs j
  join public.chillbros_customers c on c.id = j.customer_id
  where j.id=p_job_id and j.status in ('scheduled','in_progress')
  for update of j;
  if not found then raise exception 'job is not available' using errcode='P0001'; end if;

  if v_customer_tax_exempt then v_tax_rate := 0; end if;
  if v_subtotal > 0 then
    v_taxable_after_discount := greatest(v_taxable_subtotal - round(v_discount_amount * (v_taxable_subtotal / v_subtotal), 2), 0);
  end if;
  v_tax_amount := round(v_taxable_after_discount * v_tax_rate / 100, 2);
  v_total := v_after_discount + v_tax_amount;

  v_down_type:=nullif(p_adjustments ->> 'down_payment_type','');
  v_down_value:=coalesce(nullif(p_adjustments ->> 'down_payment_value','')::numeric,0);
  if v_down_type is not null and v_down_type not in ('percent','dollar') then raise exception 'invalid down payment type' using errcode='22023'; end if;
  if v_down_value < 0 then raise exception 'invalid down payment' using errcode='22023'; end if;
  if v_down_type='percent' then
    if v_down_value > 100 then raise exception 'down payment percent cannot exceed 100' using errcode='22023'; end if;
    v_down_amount:=round(v_total*v_down_value/100,2);
  elsif v_down_type='dollar' then v_down_amount:=least(v_down_value,v_total); end if;

  insert into public.chillbros_invoices(invoice_number,job_id,customer_id,status,notes,discount_type,discount_value,discount_amount,down_payment_type,down_payment_value,down_payment_amount,tax_rate,taxable_subtotal,tax_amount,payment_terms)
  values(p_invoice_number,p_job_id,v_customer_id,'awaiting_approval',nullif(p_notes,''),v_discount_type,v_discount_value,v_discount_amount,v_down_type,v_down_value,v_down_amount,v_tax_rate,v_taxable_subtotal,v_tax_amount,'due_on_receipt')
  returning id,portal_token into v_invoice_id,v_portal_token;

  for v_index in 0..v_item_count - 1 loop
    v_item:=p_line_items->v_index;
    v_label:=btrim(v_item->>'label');
    v_description:=nullif(btrim(coalesce(v_item->>'description','')),'');
    v_quantity:=coalesce(nullif(v_item->>'quantity','')::numeric,1);
    v_unit_price:=coalesce(nullif(v_item->>'unit_price','')::numeric,nullif(v_item->>'amount','')::numeric,0);
    v_taxable:=coalesce(nullif(v_item->>'taxable','')::boolean,false);
    v_amount:=round(v_quantity*v_unit_price,2);
    insert into public.chillbros_invoice_line_items(invoice_id,label,description,quantity,unit_price,amount,sort_order,taxable)
    values(v_invoice_id,v_label,v_description,v_quantity,v_unit_price,v_amount,v_index,v_taxable);
  end loop;

  insert into public.chillbros_workflow_events(job_id,invoice_id,stage,message)
  values(p_job_id,v_invoice_id,'awaiting_approval','Estimate published and awaiting customer approval.');
  return query select v_invoice_id,p_invoice_number,v_portal_token;
end; $$;

revoke all on function public.chillbros_create_estimate_v2(uuid,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.chillbros_create_estimate_v2(uuid,text,text,jsonb,jsonb) to service_role;
