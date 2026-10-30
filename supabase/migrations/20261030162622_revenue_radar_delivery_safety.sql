-- Approval is separate from the dashboard master switch. Release only after owner approval.
alter table public.chillbros_autopilot_settings add column outreach_approval_hold boolean not null default true;
alter table public.chillbros_revenue_prospects add column contact_enriched_at timestamptz;
alter table public.chillbros_outreach_log add column delivery_key text;
create unique index chillbros_outreach_delivery_key_idx on public.chillbros_outreach_log(delivery_key) where delivery_key is not null;
alter table public.chillbros_outreach_log drop constraint chillbros_outreach_log_status_check;
alter table public.chillbros_outreach_log add constraint chillbros_outreach_log_status_check
 check (status in ('sent','failed','skipped','configuration_required','dry_run','checked','reserved'));
-- Preserve historical checks while correcting their delivery classification.
update public.chillbros_outreach_log set status='checked' where lane='enrichment' and channel='none' and status='sent';
-- Seed keys from historical successful cold sends so resetting a sequence cannot resend a step.
update public.chillbros_outreach_log set delivery_key='cold:' || lower(trim(recipient)) || ':' || step
 where lane='cold' and channel='email' and status='sent';

create or replace function public.chillbros_reserve_outreach(delivery_key_input text, payload jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare settings public.chillbros_autopilot_settings; reservation uuid; used integer; cap integer;
begin
  -- Serialize approval, suppression, daily cap and reservation checks across workers.
  select * into settings from public.chillbros_autopilot_settings where id=1 for update;
  if not found or not settings.enabled or settings.outreach_approval_hold then return null; end if;
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
comment on column public.chillbros_outreach_log.delivery_key is 'Pre-send idempotency reservation. Uncertain transport results require manual review; never automatically clear keys.';
