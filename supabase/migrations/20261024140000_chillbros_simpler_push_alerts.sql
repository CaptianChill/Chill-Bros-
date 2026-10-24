-- Shorter owner alerts: colored dot for urgency, a few words, one line of detail.
--   red = act now, orange = new business, green = money/approval, blue = team, white = FYI.

create or replace function public.chillbros_fmt_window(w text)
returns text language plpgsql immutable as $$
declare m text[];
begin
  m := regexp_match(coalesce(w, ''), '^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})-(\d{2}:\d{2}) CT$');
  if m is null then return nullif(w, ''); end if;
  return to_char(m[1]::date, 'Dy Mon FMDD') || ', ' ||
    lower(regexp_replace(to_char(m[2]::time, 'FMHH12:MIAM'), ':00', '')) || '–' ||
    lower(regexp_replace(to_char(m[3]::time, 'FMHH12:MIAM'), ':00', ''));
end; $$;

create or replace function public.chillbros_push_new_job()
returns trigger language plpgsql security definer set search_path = public, extensions, net as $$
declare
  cname text;
  scope text := coalesce(new.scope, '');
  label text;
  dot text;
  prio int;
  detail text;
  s record;
begin
  if coalesce(new.scheduled_window, '') like 'Standalone %' then return new; end if;
  select name into cname from public.chillbros_customers where id = new.customer_id;
  if scope ~* '(EMERGENCY|URGENT)' then label := 'Emergency call'; dot := 'red_circle'; prio := 5;
  elsif scope like 'Online booking%' then label := 'Booked online'; dot := 'orange_circle'; prio := 4;
  elsif scope like 'Customer request%' then label := 'Customer request'; dot := 'orange_circle'; prio := 4;
  else label := 'New call'; dot := 'large_blue_circle'; prio := 3;
  end if;
  detail := concat_ws(' · ',
    coalesce(public.chillbros_fmt_window(new.scheduled_window), 'needs scheduling'),
    nullif(left(split_part(regexp_replace(scope, '^(Online booking|Customer request)[^:]*:\s*', ''), E'\n', 1), 70), ''));
  perform public.chillbros_push(label || ' · ' || coalesce(cname, 'Customer'), detail, prio, array[dot], '/jobs/' || new.id);
  begin
    select * into s from public.chillbros_notify_settings where id = 1;
    if coalesce(s.app_webhook_secret, '') <> '' then
      perform net.http_post(
        url := s.app_url || '/api/notify/new-job',
        body := jsonb_build_object('jobId', new.id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || s.app_webhook_secret),
        timeout_milliseconds := 8000
      );
    end if;
  exception when others then
    raise warning 'staff text webhook failed: %', sqlerrm;
  end;
  return new;
end; $$;

create or replace function public.chillbros_push_readings()
returns trigger language plpgsql security definer set search_path = public as $$
declare tech text; jobno text; cname text; payload jsonb;
begin
  if new.stage <> 'diagnostic_readings' then return new; end if;
  select split_part(full_name, ' ', 1) into tech from public.chillbros_profiles where id = new.actor_id;
  select j.job_number, c.name into jobno, cname from public.chillbros_jobs j left join public.chillbros_customers c on c.id = j.customer_id where j.id = new.job_id;
  begin payload := new.message::jsonb; exception when others then payload := '{}'::jsonb; end;
  perform public.chillbros_push(
    'Readings · ' || coalesce(cname, 'customer'),
    concat_ws(' · ', coalesce(tech, 'Tech'), coalesce(payload->>'category', 'diagnostic'), jobno),
    3, array['large_blue_circle'], '/jobs/' || new.job_id);
  return new;
end; $$;

create or replace function public.chillbros_push_field_note()
returns trigger language plpgsql security definer set search_path = public as $$
declare tech text;
begin
  if new.submitted_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.submitted_at is not null then return new; end if;
  select split_part(full_name, ' ', 1) into tech from public.chillbros_profiles where id = new.technician_id;
  perform public.chillbros_push(
    'Field note · ' || coalesce(tech, 'Tech'),
    concat_ws(' · ', nullif(new.customer_name_freeform, ''), 'ready for review'),
    3, array['large_blue_circle'], '/owner/field-notes/' || new.id);
  return new;
end; $$;

create or replace function public.chillbros_push_inbound_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.chillbros_push(
    case when new.urgency = 'emergency' then 'Emergency lead · ' else 'New lead · ' end || coalesce(new.name, new.email, new.phone, 'Someone'),
    concat_ws(' · ', new.source, nullif(left(split_part(coalesce(new.message, ''), E'\n', 1), 70), ''), 'auto-replied'),
    case when new.urgency = 'emergency' then 5 else 4 end,
    array[case when new.urgency = 'emergency' then 'red_circle' else 'orange_circle' end],
    '/owner/autopilot');
  return new;
end; $$;
