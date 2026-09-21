alter table public.chillbros_parts_catalog
  add column if not exists track_inventory boolean not null default true;

update public.chillbros_parts_catalog
set track_inventory = false
where part_number like 'PB-%'
   or part_number in ('Labor', 'Service charge + first hour', 'Trip charge');

create or replace function public.chillbros_add_job_part(p_job_id uuid, p_part_id uuid, p_quantity integer)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_profile_id uuid;
  v_profile_role text;
  v_stock integer;
  v_track_inventory boolean;
  v_job_part_id uuid;
begin
  if p_quantity < 1 or p_quantity > 100 then
    raise exception 'invalid quantity' using errcode = '22023';
  end if;

  select p.id, p.role::text into v_profile_id, v_profile_role
  from public.chillbros_profiles p
  where p.auth_user_id = public.chillbros_current_auth_uid() and p.status::text = 'active'
  limit 1;
  if not found or v_profile_role not in ('manager', 'technician') then
    raise exception 'active field-service account required' using errcode = '42501';
  end if;

  perform 1 from public.chillbros_jobs j
  where j.id = p_job_id
    and (
      v_profile_role = 'manager'
      or (v_profile_role = 'technician' and j.assigned_tech_id = v_profile_id
          and j.status::text in ('scheduled','in_progress','dispatched','en_route','arrived','diagnosing','awaiting_approval','approved','parts_required','return_visit_needed','repairing','work_complete'))
    )
  for update of j;
  if not found then raise exception 'job not available to this staff account' using errcode = '42501'; end if;

  select stock, track_inventory into v_stock, v_track_inventory from public.chillbros_parts_catalog where id = p_part_id for update;
  if not found then raise exception 'part not found' using errcode = 'P0001'; end if;
  if v_track_inventory and v_stock < p_quantity then raise exception 'insufficient stock' using errcode = 'P0001'; end if;

  insert into public.chillbros_job_parts(job_id, part_id, quantity) values (p_job_id, p_part_id, p_quantity)
  on conflict (job_id, part_id) do update set quantity = public.chillbros_job_parts.quantity + excluded.quantity
  returning id into v_job_part_id;
  if v_track_inventory then
    update public.chillbros_parts_catalog set stock = stock - p_quantity, updated_at = now() where id = p_part_id;
  end if;
  return v_job_part_id;
end;
$function$;

create or replace function public.chillbros_set_job_part_quantity(p_job_part_id uuid, p_quantity integer)
 returns void
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_profile_id uuid;
  v_profile_role text;
  v_part_id uuid;
  v_old_quantity integer;
  v_delta integer;
  v_stock integer;
  v_track_inventory boolean;
  v_job_id uuid;
  v_assigned_tech_id uuid;
  v_job_status text;
begin
  if p_quantity < 0 or p_quantity > 1000 then
    raise exception 'invalid quantity' using errcode = '22023';
  end if;

  select p.id, p.role::text into v_profile_id, v_profile_role
  from public.chillbros_profiles p
  where p.auth_user_id = public.chillbros_current_auth_uid() and p.status::text = 'active'
  limit 1;
  if not found or v_profile_role not in ('manager', 'technician') then
    raise exception 'active field-service account required' using errcode = '42501';
  end if;

  select jp.part_id, jp.quantity, jp.job_id into v_part_id, v_old_quantity, v_job_id
  from public.chillbros_job_parts jp where jp.id = p_job_part_id for update;
  if not found then raise exception 'job part not found' using errcode = 'P0001'; end if;

  select j.assigned_tech_id, j.status::text into v_assigned_tech_id, v_job_status
  from public.chillbros_jobs j where j.id = v_job_id for update;
  if v_profile_role = 'technician' and (
    v_assigned_tech_id is distinct from v_profile_id
    or v_job_status not in ('scheduled','in_progress','dispatched','en_route','arrived','diagnosing','awaiting_approval','approved','parts_required','return_visit_needed','repairing','work_complete')
  ) then
    raise exception 'job not available to this staff account' using errcode = '42501';
  end if;

  select stock, track_inventory into v_stock, v_track_inventory from public.chillbros_parts_catalog where id = v_part_id for update;
  if not found then raise exception 'part not found' using errcode = 'P0001'; end if;
  v_delta := p_quantity - v_old_quantity;
  if v_track_inventory and v_delta > 0 and v_stock < v_delta then raise exception 'insufficient stock' using errcode = 'P0001'; end if;

  if v_track_inventory then
    update public.chillbros_parts_catalog set stock = stock - v_delta, updated_at = now() where id = v_part_id;
  end if;
  if p_quantity = 0 then delete from public.chillbros_job_parts where id = p_job_part_id;
  else update public.chillbros_job_parts set quantity = p_quantity where id = p_job_part_id;
  end if;
end;
$function$;
