-- Tighten cold outreach only. Preserve every existing prospect and delivery reservation.
create or replace function public.chillbros_reserve_outreach(delivery_key_input text, payload jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare settings public.chillbros_autopilot_settings; reservation uuid; used integer; cap integer;
begin
  -- Serialize approval, suppression, daily cap and reservation checks across workers.
  select * into settings from public.chillbros_autopilot_settings where id=1 for update;
  if not found or not settings.enabled or settings.outreach_approval_hold then return null; end if;
  -- Recheck qualification under the reservation lock, regardless of app version.
  if payload->>'lane'='cold' then
    if not exists(select 1 from public.chillbros_revenue_prospects p
      where p.id=(payload->>'prospect_id')::uuid and p.score>=80
      and not p.do_not_contact and not p.outreach_done
      and coalesce(p.sales_status::text,'new') not in ('won','lost','do_not_contact')
      and lower(trim(p.contact_email))=lower(trim(payload->>'recipient'))
      and p.outreach_step=coalesce((payload->>'step')::int,0)) then return null; end if;
    if delivery_key_input is distinct from 'cold:' || lower(trim(payload->>'recipient')) || ':' || coalesce((payload->>'step')::int,0)::text then return null; end if;
    if exists(select 1 from public.chillbros_customers c
      cross join lateral regexp_split_to_table(lower(coalesce(c.email,'')), '[,;\s]+') e
      where e=lower(trim(payload->>'recipient'))) then return null; end if;
  end if;
  if exists(select 1 from public.chillbros_outreach_suppressions where contact=lower(trim(payload->>'recipient'))) then return null; end if;
  if payload->>'lane' in ('cold','reactivation') then
    cap := case when payload->>'lane'='cold' then settings.cold_daily_cap else settings.reactivation_daily_cap end;
    select count(*) into used from public.chillbros_outreach_log
      where lane=payload->>'lane' and status in ('sent','reserved')
      and created_at >= (date_trunc('day',now() at time zone 'America/Chicago') at time zone 'America/Chicago');
    if used >= cap then return null; end if;
  end if;
  if payload->>'lane'='cold' and exists(select 1 from public.chillbros_outreach_log
    where lane='cold' and lower(trim(recipient))=lower(trim(payload->>'recipient'))
    and prospect_id is distinct from (payload->>'prospect_id')::uuid
    and status in ('sent','reserved')) then return null; end if;
  insert into public.chillbros_outreach_log(delivery_key,lane,step,channel,recipient,prospect_id,customer_id,inbound_lead_id,subject,body,status)
  values(delivery_key_input,payload->>'lane',coalesce((payload->>'step')::int,0),payload->>'channel',lower(trim(payload->>'recipient')),
    (payload->>'prospect_id')::uuid,(payload->>'customer_id')::uuid,(payload->>'inbound_lead_id')::uuid,payload->>'subject',left(payload->>'body',8000),'reserved')
  on conflict (delivery_key) where delivery_key is not null do nothing returning id into reservation;
  return reservation;
end;
$$;
revoke all on function public.chillbros_reserve_outreach(text,jsonb) from public,anon,authenticated;
grant execute on function public.chillbros_reserve_outreach(text,jsonb) to service_role;

-- Exercise the real reservation function without committing any fixture/settings changes.
-- The nested subtransaction rolls back on the private test sentinel. Any assertion
-- failure aborts this migration, including the function replacement above.
do $verify$
declare prospect uuid; payload jsonb; reserved uuid; key text;
begin
  begin
    select id into strict prospect from public.chillbros_revenue_prospects order by id limit 1;
    update public.chillbros_autopilot_settings set enabled=true,outreach_approval_hold=false where id=1;
    update public.chillbros_revenue_prospects set score=79,do_not_contact=false,outreach_done=false,sales_status='new',outreach_step=0,contact_email='radar-qualification-fixture@example.invalid' where id=prospect;
    key := 'cold:radar-qualification-fixture@example.invalid:0';
    payload := jsonb_build_object('lane','cold','channel','email','step',0,'recipient','radar-qualification-fixture@example.invalid','prospect_id',prospect,'subject','Rollback fixture','body','Never transported');
    if public.chillbros_reserve_outreach(key,payload) is not null then raise exception 'Score 79 incorrectly reserved'; end if;
    update public.chillbros_revenue_prospects set score=80 where id=prospect;
    if public.chillbros_reserve_outreach('noncanonical-key',payload) is not null then raise exception 'Noncanonical key incorrectly reserved'; end if;
    reserved := public.chillbros_reserve_outreach(key,payload);
    if reserved is null then raise exception 'Score 80 fixture did not reserve'; end if;
    if public.chillbros_reserve_outreach(key,payload) is not null then raise exception 'Duplicate reservation accepted'; end if;
    update public.chillbros_autopilot_settings set outreach_approval_hold=true where id=1;
    if public.chillbros_reserve_outreach('held-fixture',payload) is not null then raise exception 'Hold incorrectly allowed reservation'; end if;
    raise exception using errcode='P0002', message='radar-verification-rollback';
  exception when no_data_found then
    if sqlerrm <> 'radar-verification-rollback' then raise; end if;
  end;
end;
$verify$;
