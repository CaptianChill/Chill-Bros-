-- The chillbros_jobs_prevent_rapid_duplicates trigger (chillbros_prevent_rapid_duplicate_jobs)
-- already existed live on this project but was never checked into a migration file here.
-- Recording it as-is first so the repo's migration history matches the live schema, then
-- narrowing its 30-second window down to 6 seconds in the same statement.
--
-- The 30-second window was blocking legitimate use: two distinct standalone quotes/invoices
-- created for the same customer within 30 seconds (e.g. a quote with a down payment added
-- moments after an earlier one) were being rejected as "Duplicate work order blocked", even
-- though the guard's match key (customer + scheduled_window sentinel + location + scope +
-- work_performed) doesn't consider price, line items, or down payment at all -- those fields
-- are frequently identical across genuinely separate standalone documents since location/scope
-- are usually left blank/default. 6 seconds still catches an accidental double form submission
-- (double-click, network retry) without blocking a manager creating a second real document.
create or replace function public.chillbros_prevent_rapid_duplicate_jobs()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.scheduled_window in ('Standalone invoice · internal billing record','Standalone quote · internal billing record','Owner-created invoice','Owner-created quote') then
    if exists (
      select 1 from public.chillbros_jobs j
      where j.customer_id=new.customer_id
        and j.archived_at is null
        and coalesce(j.scheduled_window,'')=coalesce(new.scheduled_window,'')
        and coalesce(j.location,'')=coalesce(new.location,'')
        and coalesce(j.scope,'')=coalesce(new.scope,'')
        and coalesce(j.work_performed,'')=coalesce(new.work_performed,'')
        and j.created_at >= now() - interval '6 seconds'
    ) then
      raise exception 'Duplicate work order blocked. This service record was just created.' using errcode='23505';
    end if;
  end if;
  return new;
end;
$function$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'chillbros_jobs_prevent_rapid_duplicates' and tgrelid = 'public.chillbros_jobs'::regclass) then
    create trigger chillbros_jobs_prevent_rapid_duplicates before insert on public.chillbros_jobs for each row execute function public.chillbros_prevent_rapid_duplicate_jobs();
  end if;
end $$;
