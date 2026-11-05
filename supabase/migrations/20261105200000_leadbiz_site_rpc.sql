-- Standalone lead-business site reads only through these two functions (anon key, no table access).
create table if not exists public.chillbros_leadbiz_settings (key text primary key, value text not null);
alter table public.chillbros_leadbiz_settings enable row level security;
-- The owner dashboard key's SHA-256 is stored as key 'site_key_sha256' (value set out of band, never in git).

create or replace function public.leadbiz_public_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'openings', (select count(*) from chillbros_revenue_prospects where category = 'opening_remodel' and sales_status = 'ready_to_call' and do_not_contact = false),
    'ready', (select count(*) from chillbros_revenue_prospects where sales_status = 'ready_to_call' and do_not_contact = false and contact_phone is not null)
  )
$$;

create or replace function public.leadbiz_owner_dashboard(p_key text)
returns json language plpgsql stable security definer set search_path = public, extensions as $$
declare expected text;
begin
  select value into expected from chillbros_leadbiz_settings where key = 'site_key_sha256';
  if expected is null or encode(digest(coalesce(p_key, ''), 'sha256'), 'hex') <> expected then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return json_build_object(
    'buyers', coalesce((select json_agg(b) from (select business_name, trade, email, status, emailed_at, followup_at, last_error from chillbros_leadbiz_buyers order by emailed_at desc nulls last limit 2000) b), '[]'::json),
    'runs', coalesce((select json_agg(r) from (select ran_at, result from chillbros_leadbiz_runs order by id desc limit 6) r), '[]'::json),
    'ready', (select count(*) from chillbros_revenue_prospects where sales_status = 'ready_to_call' and do_not_contact = false),
    'unsubscribed', (select count(*) from chillbros_outreach_suppressions)
  );
end
$$;

revoke all on function public.leadbiz_public_stats() from public;
revoke all on function public.leadbiz_owner_dashboard(text) from public;
grant execute on function public.leadbiz_public_stats() to anon, authenticated;
grant execute on function public.leadbiz_owner_dashboard(text) to anon, authenticated;
