-- Staff work texts: when a service call is created from any screen, the database asks
-- the app (POST /api/notify/new-job) to text office/dispatch staff. The app sends
-- nothing until Twilio is connected and staff have cell numbers on their profiles.
alter table public.chillbros_notify_settings add column if not exists app_webhook_secret text;

create or replace function public.chillbros_push_new_job()
returns trigger language plpgsql security definer set search_path = public, extensions, net as $$
declare
  cname text;
  scope text := coalesce(new.scope, '');
  title text;
  prio int := 3;
  s record;
begin
  if coalesce(new.scheduled_window, '') like 'Standalone %' then return new; end if;
  select name into cname from public.chillbros_customers where id = new.customer_id;
  if scope like 'Online booking%' then title := 'New service call booked online'; prio := 4;
  elsif scope like 'Customer request%' then title := 'Customer requested service'; prio := 4;
  else title := 'New service call';
  end if;
  if scope ~* '(EMERGENCY|URGENT)' then prio := 5; end if;
  perform public.chillbros_push(
    title,
    coalesce(cname, 'Customer') || coalesce(' · ' || nullif(new.scheduled_window, ''), '') || E'\n' || left(regexp_replace(scope, '^(Online booking|Customer request)[^:]*:\s*', ''), 220),
    prio, array['snowflake','calendar'], '/jobs/' || new.id
  );
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
