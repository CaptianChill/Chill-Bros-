alter table public.chillbros_invoice_line_items
  add column if not exists description text,
  add column if not exists quantity numeric(10,2) not null default 1,
  add column if not exists unit_price numeric(12,2);

update public.chillbros_invoice_line_items
set unit_price = amount / nullif(quantity, 0)
where unit_price is null;

alter table public.chillbros_invoice_line_items alter column unit_price set not null;

alter table public.chillbros_invoice_line_items
  drop constraint if exists chillbros_invoice_line_items_valid_description,
  drop constraint if exists chillbros_invoice_line_items_valid_quantity,
  drop constraint if exists chillbros_invoice_line_items_valid_unit_price;

alter table public.chillbros_invoice_line_items
  add constraint chillbros_invoice_line_items_valid_description check (description is null or length(description) <= 1000),
  add constraint chillbros_invoice_line_items_valid_quantity check (quantity > 0 and quantity <= 1000),
  add constraint chillbros_invoice_line_items_valid_unit_price check (unit_price >= 0 and unit_price <= 100000);

alter table public.chillbros_invoices
  add column if not exists discount_type text,
  add column if not exists discount_value numeric(12,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists down_payment_type text,
  add column if not exists down_payment_value numeric(12,2) not null default 0,
  add column if not exists down_payment_amount numeric(12,2) not null default 0;

alter table public.chillbros_invoices
  drop constraint if exists chillbros_invoices_valid_discount_type,
  drop constraint if exists chillbros_invoices_valid_discount_value,
  drop constraint if exists chillbros_invoices_valid_discount_amount,
  drop constraint if exists chillbros_invoices_valid_down_payment_type,
  drop constraint if exists chillbros_invoices_valid_down_payment_value,
  drop constraint if exists chillbros_invoices_valid_down_payment_amount;

alter table public.chillbros_invoices
  add constraint chillbros_invoices_valid_discount_type check (discount_type is null or discount_type in ('percent','dollar')),
  add constraint chillbros_invoices_valid_discount_value check (discount_value >= 0 and discount_value <= 250000),
  add constraint chillbros_invoices_valid_discount_amount check (discount_amount >= 0 and discount_amount <= 250000),
  add constraint chillbros_invoices_valid_down_payment_type check (down_payment_type is null or down_payment_type in ('percent','dollar')),
  add constraint chillbros_invoices_valid_down_payment_value check (down_payment_value >= 0 and down_payment_value <= 250000),
  add constraint chillbros_invoices_valid_down_payment_amount check (down_payment_amount >= 0 and down_payment_amount <= 250000);

with ranked as (
  select id, job_id, part_id, quantity,
         row_number() over (partition by job_id, part_id order by id) as rn,
         sum(quantity) over (partition by job_id, part_id) as total_qty
  from public.chillbros_job_parts
), updated as (
  update public.chillbros_job_parts jp set quantity = r.total_qty
  from ranked r where jp.id = r.id and r.rn = 1 returning jp.id
)
delete from public.chillbros_job_parts jp using ranked r where jp.id = r.id and r.rn > 1;

create unique index if not exists chillbros_job_parts_job_part_uidx on public.chillbros_job_parts(job_id, part_id);

create table if not exists public.chillbros_timesheet_breaks (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid not null references public.chillbros_timesheets(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chillbros_timesheet_breaks_valid_range check (ended_at is null or ended_at >= started_at)
);
create unique index if not exists chillbros_timesheet_breaks_one_open_idx on public.chillbros_timesheet_breaks(timesheet_id) where ended_at is null;
create index if not exists chillbros_timesheet_breaks_timesheet_idx on public.chillbros_timesheet_breaks(timesheet_id, started_at);
alter table public.chillbros_timesheet_breaks enable row level security;
revoke all on table public.chillbros_timesheet_breaks from public, anon, authenticated;
grant all on table public.chillbros_timesheet_breaks to service_role;

create table if not exists public.chillbros_workflow_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.chillbros_jobs(id) on delete cascade,
  invoice_id uuid references public.chillbros_invoices(id) on delete cascade,
  actor_id uuid references public.chillbros_profiles(id) on delete set null,
  stage text not null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint chillbros_workflow_events_stage_len check (length(stage) between 1 and 80),
  constraint chillbros_workflow_events_message_len check (length(message) between 1 and 1000)
);
create index if not exists chillbros_workflow_events_job_idx on public.chillbros_workflow_events(job_id, created_at desc);
create index if not exists chillbros_workflow_events_invoice_idx on public.chillbros_workflow_events(invoice_id, created_at desc);
create index if not exists chillbros_workflow_events_created_idx on public.chillbros_workflow_events(created_at desc);
alter table public.chillbros_workflow_events enable row level security;
revoke all on table public.chillbros_workflow_events from public, anon, authenticated;
grant all on table public.chillbros_workflow_events to service_role;

create or replace function public.chillbros_add_job_part(p_job_id uuid, p_part_id uuid, p_quantity integer)
returns uuid language plpgsql set search_path = '' as $$
declare v_stock integer; v_job_part_id uuid;
begin
  if p_quantity < 1 or p_quantity > 100 then raise exception 'invalid quantity' using errcode = '22023'; end if;
  perform 1 from public.chillbros_jobs where id = p_job_id for update;
  if not found then raise exception 'job not found' using errcode = 'P0001'; end if;
  select stock into v_stock from public.chillbros_parts_catalog where id = p_part_id for update;
  if not found then raise exception 'part not found' using errcode = 'P0001'; end if;
  if v_stock < p_quantity then raise exception 'insufficient stock' using errcode = 'P0001'; end if;
  insert into public.chillbros_job_parts(job_id, part_id, quantity) values (p_job_id, p_part_id, p_quantity)
  on conflict (job_id, part_id) do update set quantity = public.chillbros_job_parts.quantity + excluded.quantity
  returning id into v_job_part_id;
  update public.chillbros_parts_catalog set stock = stock - p_quantity, updated_at = now() where id = p_part_id;
  return v_job_part_id;
end; $$;

create or replace function public.chillbros_set_job_part_quantity(p_job_part_id uuid, p_quantity integer)
returns void language plpgsql set search_path = '' as $$
declare v_part_id uuid; v_old_quantity integer; v_delta integer; v_stock integer;
begin
  if p_quantity < 0 or p_quantity > 1000 then raise exception 'invalid quantity' using errcode = '22023'; end if;
  select part_id, quantity into v_part_id, v_old_quantity from public.chillbros_job_parts where id = p_job_part_id for update;
  if not found then raise exception 'job part not found' using errcode = 'P0001'; end if;
  select stock into v_stock from public.chillbros_parts_catalog where id = v_part_id for update;
  if not found then raise exception 'part not found' using errcode = 'P0001'; end if;
  v_delta := p_quantity - v_old_quantity;
  if v_delta > 0 and v_stock < v_delta then raise exception 'insufficient stock' using errcode = 'P0001'; end if;
  update public.chillbros_parts_catalog set stock = stock - v_delta, updated_at = now() where id = v_part_id;
  if p_quantity = 0 then delete from public.chillbros_job_parts where id = p_job_part_id;
  else update public.chillbros_job_parts set quantity = p_quantity where id = p_job_part_id; end if;
end; $$;

create or replace function public.chillbros_create_estimate_v2(p_job_id uuid,p_invoice_number text,p_notes text,p_line_items jsonb,p_adjustments jsonb)
returns table(estimate_id uuid, estimate_number text, estimate_token uuid)
language plpgsql set search_path = '' as $$
declare
  v_customer_id uuid; v_invoice_id uuid; v_portal_token uuid; v_item jsonb; v_label text; v_description text;
  v_quantity numeric; v_unit_price numeric; v_amount numeric; v_subtotal numeric := 0; v_item_count integer; v_index integer;
  v_discount_type text; v_discount_value numeric := 0; v_discount_amount numeric := 0; v_down_type text; v_down_value numeric := 0; v_down_amount numeric := 0; v_after_discount numeric;
begin
  if jsonb_typeof(p_line_items) <> 'array' then raise exception 'line items must be an array' using errcode='22023'; end if;
  v_item_count := jsonb_array_length(p_line_items);
  if v_item_count < 1 or v_item_count > 20 then raise exception 'invalid line item count' using errcode='22023'; end if;
  if p_notes is not null and length(p_notes) > 2000 then raise exception 'notes are too long' using errcode='22023'; end if;
  for v_index in 0..v_item_count - 1 loop
    v_item := p_line_items -> v_index; v_label := btrim(v_item ->> 'label'); v_description := nullif(btrim(coalesce(v_item ->> 'description','')), '');
    v_quantity := coalesce(nullif(v_item ->> 'quantity','')::numeric, 1); v_unit_price := coalesce(nullif(v_item ->> 'unit_price','')::numeric, nullif(v_item ->> 'amount','')::numeric, 0); v_amount := round(v_quantity * v_unit_price, 2);
    if v_label is null or length(v_label) < 1 or length(v_label) > 200 or (v_description is not null and length(v_description) > 1000) or v_quantity <= 0 or v_quantity > 1000 or v_unit_price < 0 or v_unit_price > 100000 then raise exception 'invalid line item' using errcode='22023'; end if;
    v_subtotal := v_subtotal + v_amount;
  end loop;
  if v_subtotal <= 0 or v_subtotal > 250000 then raise exception 'invalid estimate total' using errcode='22023'; end if;
  v_discount_type := nullif(p_adjustments ->> 'discount_type',''); v_discount_value := coalesce(nullif(p_adjustments ->> 'discount_value','')::numeric,0);
  if v_discount_type is not null and v_discount_type not in ('percent','dollar') then raise exception 'invalid discount type' using errcode='22023'; end if;
  if v_discount_value < 0 then raise exception 'invalid discount' using errcode='22023'; end if;
  if v_discount_type='percent' then if v_discount_value > 100 then raise exception 'discount percent cannot exceed 100' using errcode='22023'; end if; v_discount_amount:=round(v_subtotal*v_discount_value/100,2);
  elsif v_discount_type='dollar' then v_discount_amount:=least(v_discount_value,v_subtotal); end if;
  v_after_discount:=greatest(v_subtotal-v_discount_amount,0);
  v_down_type:=nullif(p_adjustments ->> 'down_payment_type',''); v_down_value:=coalesce(nullif(p_adjustments ->> 'down_payment_value','')::numeric,0);
  if v_down_type is not null and v_down_type not in ('percent','dollar') then raise exception 'invalid down payment type' using errcode='22023'; end if;
  if v_down_value < 0 then raise exception 'invalid down payment' using errcode='22023'; end if;
  if v_down_type='percent' then if v_down_value > 100 then raise exception 'down payment percent cannot exceed 100' using errcode='22023'; end if; v_down_amount:=round(v_after_discount*v_down_value/100,2);
  elsif v_down_type='dollar' then v_down_amount:=least(v_down_value,v_after_discount); end if;
  select customer_id into v_customer_id from public.chillbros_jobs where id=p_job_id and status in ('scheduled','in_progress') for update;
  if not found then raise exception 'job is not available' using errcode='P0001'; end if;
  insert into public.chillbros_invoices(invoice_number,job_id,customer_id,status,notes,discount_type,discount_value,discount_amount,down_payment_type,down_payment_value,down_payment_amount)
  values(p_invoice_number,p_job_id,v_customer_id,'awaiting_approval',nullif(p_notes,''),v_discount_type,v_discount_value,v_discount_amount,v_down_type,v_down_value,v_down_amount)
  returning id,portal_token into v_invoice_id,v_portal_token;
  for v_index in 0..v_item_count - 1 loop
    v_item:=p_line_items->v_index; v_label:=btrim(v_item->>'label'); v_description:=nullif(btrim(coalesce(v_item->>'description','')),''); v_quantity:=coalesce(nullif(v_item->>'quantity','')::numeric,1); v_unit_price:=coalesce(nullif(v_item->>'unit_price','')::numeric,nullif(v_item->>'amount','')::numeric,0); v_amount:=round(v_quantity*v_unit_price,2);
    insert into public.chillbros_invoice_line_items(invoice_id,label,description,quantity,unit_price,amount,sort_order) values(v_invoice_id,v_label,v_description,v_quantity,v_unit_price,v_amount,v_index);
  end loop;
  insert into public.chillbros_workflow_events(job_id,invoice_id,stage,message) values(p_job_id,v_invoice_id,'awaiting_approval','Estimate published and awaiting customer approval.');
  return query select v_invoice_id,p_invoice_number,v_portal_token;
end; $$;

revoke all on function public.chillbros_add_job_part(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.chillbros_add_job_part(uuid,uuid,integer) to service_role;
revoke all on function public.chillbros_set_job_part_quantity(uuid,integer) from public, anon, authenticated;
grant execute on function public.chillbros_set_job_part_quantity(uuid,integer) to service_role;
revoke all on function public.chillbros_create_estimate_v2(uuid,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.chillbros_create_estimate_v2(uuid,text,text,jsonb,jsonb) to service_role;
