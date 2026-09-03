create table public.chillbros_equipment (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.chillbros_customers(id),
  equipment_type text not null,
  manufacturer text,
  model text,
  serial_number text,
  refrigerant text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chillbros_equipment_type_valid check (length(btrim(equipment_type)) between 1 and 120),
  constraint chillbros_equipment_notes_valid check (notes is null or length(notes) <= 4000)
);
create index chillbros_equipment_customer_idx on public.chillbros_equipment(customer_id);
alter table public.chillbros_equipment enable row level security;
revoke all on table public.chillbros_equipment from public, anon, authenticated;
grant all on table public.chillbros_equipment to service_role;

alter table public.chillbros_jobs add column equipment_id uuid references public.chillbros_equipment(id);
create index chillbros_jobs_equipment_idx on public.chillbros_jobs(equipment_id);

create or replace function public.chillbros_add_job_part(p_job_id uuid, p_part_id uuid, p_quantity integer)
returns uuid language plpgsql security invoker set search_path = '' as $function$
declare v_stock integer; v_job_part_id uuid;
begin
  if p_quantity < 1 or p_quantity > 100 then raise exception 'invalid quantity' using errcode = '22023'; end if;
  perform 1 from public.chillbros_jobs where id = p_job_id for update;
  if not found then raise exception 'job not found' using errcode = 'P0001'; end if;
  select stock into v_stock from public.chillbros_parts_catalog where id = p_part_id for update;
  if not found then raise exception 'part not found' using errcode = 'P0001'; end if;
  if v_stock < p_quantity then raise exception 'insufficient stock' using errcode = 'P0001'; end if;
  insert into public.chillbros_job_parts(job_id, part_id, quantity) values (p_job_id, p_part_id, p_quantity) returning id into v_job_part_id;
  update public.chillbros_parts_catalog set stock = stock - p_quantity, updated_at = now() where id = p_part_id;
  return v_job_part_id;
end;
$function$;

create or replace function public.chillbros_remove_job_part(p_job_part_id uuid)
returns void language plpgsql security invoker set search_path = '' as $function$
declare v_part_id uuid; v_quantity integer;
begin
  select part_id, quantity into v_part_id, v_quantity from public.chillbros_job_parts where id = p_job_part_id for update;
  if not found then raise exception 'job part not found' using errcode = 'P0001'; end if;
  perform 1 from public.chillbros_parts_catalog where id = v_part_id for update;
  update public.chillbros_parts_catalog set stock = stock + v_quantity, updated_at = now() where id = v_part_id;
  delete from public.chillbros_job_parts where id = p_job_part_id;
end;
$function$;

revoke all on function public.chillbros_add_job_part(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.chillbros_add_job_part(uuid, uuid, integer) to service_role;
revoke all on function public.chillbros_remove_job_part(uuid) from public, anon, authenticated;
grant execute on function public.chillbros_remove_job_part(uuid) to service_role;
