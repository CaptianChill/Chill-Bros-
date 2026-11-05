-- Versioned, sender-specific human evidence. Discovery never creates approvals.
create table public.chillbros_outreach_senders (
  sender_key text primary key check (sender_key ~ '^[a-z0-9-]{3,80}$'),
  display_name text not null,
  kind text not null check (kind in ('owner','buyer')),
  transport_ready boolean not null default false,
  approval_hold boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.chillbros_outreach_senders(sender_key,display_name,kind,transport_ready,approval_hold)
values ('chill-pros','Chill Pros','owner',true,false);
-- The existing global approval hold remains authoritative and unchanged.
alter table public.chillbros_outreach_senders enable row level security;
revoke all on public.chillbros_outreach_senders from public,anon,authenticated;
grant select,insert,update on public.chillbros_outreach_senders to service_role;

create table public.chillbros_outreach_reviews (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.chillbros_revenue_prospects(id),
  sender_key text not null references public.chillbros_outreach_senders(sender_key),
  policy_version text not null default 'v1' check (policy_version='v1'),
  verdict text not null check (verdict in ('approved','blocked')),
  tier text not null check (tier in ('researched_prospect','confirmed_need')),
  contact_checked_at timestamptz,
  source_checked_at timestamptz,
  need_confirmed_at timestamptz,
  contact_evidence text not null default '',
  source_rights_evidence text not null default '',
  need_evidence text not null default '',
  location_verified boolean not null default false,
  role_verified boolean not null default false,
  outreach_permitted boolean not null default false,
  resale_permitted boolean not null default false,
  sharing_permitted boolean not null default false,
  reviewed_by uuid not null references public.chillbros_profiles(id),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index chillbros_outreach_reviews_latest on public.chillbros_outreach_reviews(prospect_id,sender_key,created_at desc);
alter table public.chillbros_outreach_reviews enable row level security;
revoke all on public.chillbros_outreach_reviews from public,anon,authenticated;
grant select,insert on public.chillbros_outreach_reviews to service_role;

create function public.chillbros_outreach_snapshot(p public.chillbros_revenue_prospects)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('business_name',p.business_name,'city',p.city,
    'business_address',p.business_address,'contact_email',lower(trim(p.contact_email)),
    'contact_name',p.contact_name,'contact_role',p.contact_role,'contact_phone',p.contact_phone,
    'source_url',p.source_url,'signal_summary',p.signal_summary,
    'signal_observed_at',p.signal_observed_at,'service_line',p.service_line);
$$;

create function public.chillbros_outreach_review_insert()
returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.chillbros_revenue_prospects;
begin
  if not exists(select 1 from public.chillbros_profiles where id=new.reviewed_by and role::text='manager' and status::text='active') then
    raise exception 'Only an active manager may review outreach evidence';
  end if;
  select * into strict p from public.chillbros_revenue_prospects where id=new.prospect_id for update;
  if new.snapshot is distinct from public.chillbros_outreach_snapshot(p) then
    raise exception 'Lead changed while the review form was open; reload and review again';
  end if;
  new.snapshot := public.chillbros_outreach_snapshot(p);
  new.created_at := clock_timestamp();
  if new.verdict='approved' and (
    new.contact_checked_at is null or new.source_checked_at is null
    or new.contact_checked_at>now() or new.source_checked_at>now()
    or new.contact_checked_at<now()-interval '30 days' or new.source_checked_at<now()-interval '30 days'
    or length(trim(new.contact_evidence))<20 or length(trim(new.source_rights_evidence))<20
    or not new.location_verified or not new.role_verified or not new.outreach_permitted
    or nullif(trim(p.business_address),'') is null
    or nullif(trim(p.contact_email),'') is null
    or (new.tier='confirmed_need' and (new.need_confirmed_at is null or new.need_confirmed_at>now()
      or new.need_confirmed_at<now()-interval '7 days' or length(trim(new.need_evidence))<20))
  ) then raise exception 'Fresh contact, location, role and source-rights evidence is required'; end if;
  return new;
end;
$$;
create trigger chillbros_outreach_review_evidence before insert on public.chillbros_outreach_reviews
for each row execute function public.chillbros_outreach_review_insert();

create function public.chillbros_outreach_review_snapshot(prospect_id_input uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select public.chillbros_outreach_snapshot(p) from public.chillbros_revenue_prospects p where id=prospect_id_input;
$$;

create function public.chillbros_outreach_policy_check(prospect_id_input uuid, sender_key_input text default 'chill-pros')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare p public.chillbros_revenue_prospects; r public.chillbros_outreach_reviews;
  s public.chillbros_outreach_senders; reasons text[] := '{}';
begin
  select * into p from public.chillbros_revenue_prospects where id=prospect_id_input;
  if not found then return jsonb_build_object('eligible',false,'reasons',jsonb_build_array('Lead not found')); end if;
  select * into s from public.chillbros_outreach_senders where sender_key=sender_key_input;
  if not found or not s.transport_ready or s.approval_hold then reasons:=array_append(reasons,'Sender is held or its transport is not configured'); end if;
  if not exists(select 1 from public.chillbros_autopilot_settings where id=1 and enabled and not outreach_approval_hold and cold_email_enabled) then
    reasons:=array_append(reasons,'Global outreach approval hold or cold outreach disabled');
  end if;
  if p.do_not_contact or p.outreach_done or p.status::text in ('skipped','won','lost')
    or coalesce(p.sales_status::text,'new') in ('won','lost','do_not_contact') then reasons:=array_append(reasons,'Lead is restricted or its sequence is finished'); end if;
  if nullif(trim(p.business_address),'') is null then reasons:=array_append(reasons,'Business location is missing'); end if;
  if p.score<80 then reasons:=array_append(reasons,'Service fit is below the cold outreach floor of 80 (fit is not buying intent)'); end if;
  if coalesce(p.contact_email,'') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then reasons:=array_append(reasons,'Usable email is missing'); end if;
  if exists(select 1 from public.chillbros_outreach_suppressions where lower(trim(contact))=lower(trim(p.contact_email)))
    or exists(select 1 from public.chillbros_revenue_contacts c where c.do_not_contact and lower(trim(c.email))=lower(trim(p.contact_email))) then
    reasons:=array_append(reasons,'Contact is suppressed or opted out');
  end if;
  if exists(select 1 from public.chillbros_customers c where lower(trim(c.name))=lower(trim(p.business_name))
    or lower(trim(p.contact_email))=any(regexp_split_to_array(lower(coalesce(c.email,'')), '[,;\s]+'))) then
    reasons:=array_append(reasons,'Existing Chill Pros customer');
  end if;
  if exists(select 1 from public.chillbros_revenue_prospects d where d.id<>p.id and (
    lower(rtrim(d.source_url,'/'))=lower(rtrim(p.source_url,'/'))
    or (regexp_replace(lower(d.business_name),'[^a-z0-9]','','g')=regexp_replace(lower(p.business_name),'[^a-z0-9]','','g')
      and regexp_replace(lower(d.business_address),'[^a-z0-9]','','g')=regexp_replace(lower(p.business_address),'[^a-z0-9]','','g')))) then
    reasons:=array_append(reasons,'Duplicate source or business location requires resolution');
  end if;
  -- Do not let a checkbox authorize the optional Maps export path.
  if p.source_url ~* '^https?://([^/]*\.)?(google\.[^/]+|googleapis\.com|maps\.app\.goo\.gl)/' then
    reasons:=array_append(reasons,'Google Maps source is not approved for this outreach/resale workflow');
  end if;
  select * into r from public.chillbros_outreach_reviews where prospect_id=p.id and sender_key=sender_key_input order by created_at desc,id desc limit 1;
  if not found or r.verdict<>'approved' then reasons:=array_append(reasons,'Manager evidence review is required');
  else
    if r.snapshot is distinct from public.chillbros_outreach_snapshot(p) then reasons:=array_append(reasons,'Lead or contact changed since review'); end if;
    if r.contact_checked_at<now()-interval '30 days' or r.source_checked_at<now()-interval '30 days' then reasons:=array_append(reasons,'Contact or source review expired (30 days)'); end if;
    if r.tier='confirmed_need' and r.need_confirmed_at<now()-interval '7 days' then reasons:=array_append(reasons,'Confirmed need expired (7 days)'); end if;
    if not exists(select 1 from public.chillbros_profiles where id=r.reviewed_by and role::text='manager' and status::text='active') then reasons:=array_append(reasons,'Reviewer is no longer an active manager'); end if;
    if s.kind='buyer' and (not r.resale_permitted or not r.sharing_permitted) then reasons:=array_append(reasons,'Buyer resale rights and sharing permission are required'); end if;
  end if;
  return jsonb_build_object('eligible',cardinality(reasons)=0,'reasons',to_jsonb(reasons),'policy_version','v1','review_id',r.id,'tier',r.tier,
    'expires_at',least(r.contact_checked_at+interval '30 days',r.source_checked_at+interval '30 days',case when r.tier='confirmed_need' then r.need_confirmed_at+interval '7 days' else r.contact_checked_at+interval '30 days' end));
end;
$$;

alter table public.chillbros_outreach_log add column outreach_sender_key text not null default 'chill-pros' references public.chillbros_outreach_senders(sender_key);
alter table public.chillbros_outreach_log add column qualification_review_id uuid references public.chillbros_outreach_reviews(id);

create function public.chillbros_outreach_policy_batch(prospect_ids uuid[], sender_key_input text default 'chill-pros')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if coalesce(cardinality(prospect_ids),0)>500 then raise exception 'Outreach review batch is limited to 500 leads'; end if;
  return (select coalesce(jsonb_object_agg(id::text,public.chillbros_outreach_policy_check(id,sender_key_input)),'{}'::jsonb) from unnest(prospect_ids) id);
end;
$$;
revoke all on function public.chillbros_outreach_policy_batch(uuid[],text) from public,anon,authenticated;
grant execute on function public.chillbros_outreach_policy_batch(uuid[],text) to service_role;

-- Enforce in the database even for older applications and direct log inserts.
create function public.chillbros_outreach_policy_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
declare decision jsonb;
begin
  if new.lane='cold' and new.status in ('reserved','sent') then
    if tg_op='UPDATE' and old.status='reserved' and new.status='sent'
      and (new.prospect_id,new.recipient,new.outreach_sender_key,new.subject,new.body,new.step,new.delivery_key,new.qualification_review_id)
      is not distinct from (old.prospect_id,old.recipient,old.outreach_sender_key,old.subject,old.body,old.step,old.delivery_key,old.qualification_review_id) then
      return new; -- Finalizing an accepted delivery must remain possible after expiry.
    end if;
    perform 1 from public.chillbros_autopilot_settings where id=1 for update;
    perform 1 from public.chillbros_revenue_prospects where id=new.prospect_id for update;
    decision:=public.chillbros_outreach_policy_check(new.prospect_id,new.outreach_sender_key);
    if not coalesce((decision->>'eligible')::boolean,false) then raise exception 'Outreach policy blocked: %',decision->'reasons'; end if;
    if not exists(select 1 from public.chillbros_revenue_prospects where id=new.prospect_id and lower(trim(contact_email))=lower(trim(new.recipient))) then raise exception 'Recipient changed'; end if;
    new.qualification_review_id:=(decision->>'review_id')::uuid;
  end if;
  return new;
end;
$$;
create trigger chillbros_outreach_policy_enforced before insert or update on public.chillbros_outreach_log
for each row execute function public.chillbros_outreach_policy_guard();

-- All new functions are server-only; no public RPC grants, no client RLS bypass.
revoke all on function public.chillbros_outreach_snapshot(public.chillbros_revenue_prospects),public.chillbros_outreach_review_insert(),public.chillbros_outreach_policy_check(uuid,text),public.chillbros_outreach_policy_guard() from public,anon,authenticated;
grant execute on function public.chillbros_outreach_snapshot(public.chillbros_revenue_prospects),public.chillbros_outreach_review_insert(),public.chillbros_outreach_policy_check(uuid,text),public.chillbros_outreach_policy_guard() to service_role;
revoke all on function public.chillbros_outreach_review_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.chillbros_outreach_review_snapshot(uuid) to service_role;

-- Preserve existing reservation/cap/idempotency semantics and recheck v1 before insert.
create or replace function public.chillbros_reserve_outreach(delivery_key_input text, payload jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare settings public.chillbros_autopilot_settings; reservation uuid; used integer; cap integer; decision jsonb;
begin
  select * into settings from public.chillbros_autopilot_settings where id=1 for update;
  if not found or not settings.enabled or settings.outreach_approval_hold then return null; end if;
  -- Buyer transport is deliberately unavailable until isolated credentials/access exist.
  if coalesce(payload->>'outreach_sender_key','chill-pros')<>'chill-pros' then return null; end if;
  if payload->>'lane'='cold' then
    perform 1 from public.chillbros_revenue_prospects where id=(payload->>'prospect_id')::uuid for update;
    decision:=public.chillbros_outreach_policy_check((payload->>'prospect_id')::uuid,'chill-pros');
    if not coalesce((decision->>'eligible')::boolean,false) then return null; end if;
    if not exists(select 1 from public.chillbros_revenue_prospects p
      where p.id=(payload->>'prospect_id')::uuid and lower(trim(p.contact_email))=lower(trim(payload->>'recipient'))
      and p.outreach_step=coalesce((payload->>'step')::int,0)) then return null; end if;
    if delivery_key_input is distinct from 'cold:' || lower(trim(payload->>'recipient')) || ':' || coalesce((payload->>'step')::int,0)::text then return null; end if;
  end if;
  if exists(select 1 from public.chillbros_outreach_suppressions where contact=lower(trim(payload->>'recipient'))) then return null; end if;
  if payload->>'lane' in ('cold','reactivation') then
    cap:=case when payload->>'lane'='cold' then settings.cold_daily_cap else settings.reactivation_daily_cap end;
    select count(*) into used from public.chillbros_outreach_log where lane=payload->>'lane' and status in ('sent','reserved')
      and created_at >= (date_trunc('day',now() at time zone 'America/Chicago') at time zone 'America/Chicago');
    if used>=cap then return null; end if;
  end if;
  if payload->>'lane'='cold' and exists(select 1 from public.chillbros_outreach_log where lane='cold'
    and lower(trim(recipient))=lower(trim(payload->>'recipient')) and prospect_id is distinct from (payload->>'prospect_id')::uuid
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
