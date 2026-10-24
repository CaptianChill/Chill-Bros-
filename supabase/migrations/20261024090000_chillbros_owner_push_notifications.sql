-- Owner phone notifications through ntfy (https://ntfy.sh).
-- Database triggers push the events that can be created from many screens (new service
-- calls, technician readings, field notes, inbound leads); the app pushes the rest
-- (approvals, payments, Autopilot summaries) via lib/chillbros/notify.ts.
-- The topic is private: anyone who knows it can read the feed, so it is random.

create table if not exists public.chillbros_notify_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  ntfy_server text not null default 'https://ntfy.sh',
  ntfy_topic text,
  app_url text not null default 'https://chill-bros.vercel.app',
  updated_at timestamptz not null default now()
);
insert into public.chillbros_notify_settings (id) values (1) on conflict (id) do nothing;
alter table public.chillbros_notify_settings enable row level security;

create or replace function public.chillbros_push(p_title text, p_message text, p_priority int default 3, p_tags text[] default '{}', p_path text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  s record;
begin
  select * into s from public.chillbros_notify_settings where id = 1;
  if s is null or not s.enabled or coalesce(s.ntfy_topic, '') = '' then return; end if;
  perform net.http_post(
    url := s.ntfy_server,
    body := jsonb_build_object(
      'topic', s.ntfy_topic,
      'title', left(coalesce(p_title, 'Chill Pros'), 120),
      'message', left(coalesce(p_message, ''), 900),
      'priority', greatest(1, least(5, coalesce(p_priority, 3))),
      'tags', to_jsonb(coalesce(p_tags, '{}')),
      'click', case when p_path is null then s.app_url else s.app_url || p_path end
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
exception when others then
  -- A notification must never block the business action that triggered it.
  raise warning 'chillbros_push failed: %', sqlerrm;
end;
$$;
revoke all on function public.chillbros_push(text, text, int, text[], text) from public, anon, authenticated;

-- New service calls from any screen (office, customer homepage, online booking).
create or replace function public.chillbros_push_new_job()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cname text;
  scope text := coalesce(new.scope, '');
  title text;
  prio int := 3;
begin
  if coalesce(new.scheduled_window, '') like 'Standalone %' then return new; end if; -- internal billing records
  select name into cname from public.chillbros_customers where id = new.customer_id;
  if scope like 'Online booking%' then
    title := 'New service call booked online';
    prio := 4;
  elsif scope like 'Customer request%' then
    title := 'Customer requested service';
    prio := 4;
  else
    title := 'New service call';
  end if;
  if scope ~* '(EMERGENCY|URGENT)' then prio := 5; end if;
  perform public.chillbros_push(
    title,
    coalesce(cname, 'Customer') || coalesce(' · ' || nullif(new.scheduled_window, ''), '') || E'\n' || left(regexp_replace(scope, '^(Online booking|Customer request)[^:]*:\s*', ''), 220),
    prio, array['snowflake','calendar'], '/jobs/' || new.id
  );
  return new;
end; $$;

create or replace trigger chillbros_push_new_job after insert on public.chillbros_jobs for each row execute function public.chillbros_push_new_job();

-- Technician diagnostic readings.
create or replace function public.chillbros_push_readings()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tech text; jobno text; cname text; payload jsonb;
begin
  if new.stage <> 'diagnostic_readings' then return new; end if;
  select full_name into tech from public.chillbros_profiles where id = new.actor_id;
  select j.job_number, c.name into jobno, cname from public.chillbros_jobs j left join public.chillbros_customers c on c.id = j.customer_id where j.id = new.job_id;
  begin payload := new.message::jsonb; exception when others then payload := '{}'::jsonb; end;
  perform public.chillbros_push(
    'Readings logged' || coalesce(' · ' || jobno, ''),
    coalesce(tech, 'Technician') || ' logged ' || coalesce(payload->>'category', 'diagnostic') || ' readings for ' || coalesce(cname, 'a customer') ||
      coalesce(E'\n' || nullif(payload->>'notes', ''), ''),
    3, array['thermometer'], '/jobs/' || new.job_id
  );
  return new;
end; $$;

create or replace trigger chillbros_push_readings after insert on public.chillbros_workflow_events for each row execute function public.chillbros_push_readings();

-- Field notes submitted by a technician.
create or replace function public.chillbros_push_field_note()
returns trigger language plpgsql security definer set search_path = public as $$
declare tech text;
begin
  if new.submitted_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.submitted_at is not null then return new; end if;
  select full_name into tech from public.chillbros_profiles where id = new.technician_id;
  perform public.chillbros_push(
    'Field note submitted',
    coalesce(tech, 'A technician') || ' sent a field note' || coalesce(' for ' || nullif(new.customer_name_freeform, ''), '') || '. It is in your review inbox.',
    3, array['memo'], '/owner/field-notes/' || new.id
  );
  return new;
end; $$;

create or replace trigger chillbros_push_field_note after insert or update of submitted_at on public.chillbros_field_note_submissions for each row execute function public.chillbros_push_field_note();

-- New inbound leads (website, Google, Thumbtack, Angi forwarding).
create or replace function public.chillbros_push_inbound_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.chillbros_push(
    'New lead' || case when new.urgency <> 'routine' then ' (' || upper(new.urgency) || ')' else '' end,
    coalesce(new.name, new.email, new.phone, 'Someone') || ' via ' || new.source || coalesce(E'\n' || left(new.message, 200), '') || E'\nAutopilot is replying now.',
    case when new.urgency = 'emergency' then 5 when new.urgency = 'urgent' then 4 else 3 end,
    array['incoming_envelope'], '/owner/autopilot'
  );
  return new;
end; $$;

create or replace trigger chillbros_push_inbound_lead after insert on public.chillbros_inbound_leads for each row execute function public.chillbros_push_inbound_lead();
update public.chillbros_notify_settings set ntfy_topic = coalesce(ntfy_topic, 'chillpros-590d36131cd3') where id = 1;
