-- Supabase default privileges can grant ALL to service_role on new tables.
-- Explicitly remove inherited table grants before granting append-only access.
revoke all on public.chillbros_outreach_reviews from service_role;
grant select,insert on public.chillbros_outreach_reviews to service_role;
revoke all on public.chillbros_outreach_senders from service_role;
grant select,insert,update on public.chillbros_outreach_senders to service_role;

create index chillbros_outreach_source_identity on public.chillbros_revenue_prospects(lower(rtrim(source_url,'/')));
create index chillbros_outreach_location_identity on public.chillbros_revenue_prospects
  (regexp_replace(lower(business_name),'[^a-z0-9]','','g'),regexp_replace(lower(business_address),'[^a-z0-9]','','g'));

-- An epoch value keeps snapshots independent of pooled connection timezones.
create or replace function public.chillbros_outreach_snapshot(p public.chillbros_revenue_prospects)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('business_name',p.business_name,'city',p.city,
    'business_address',p.business_address,'contact_email',lower(trim(p.contact_email)),
    'contact_name',p.contact_name,'contact_role',p.contact_role,'contact_phone',p.contact_phone,
    'source_url',p.source_url,'signal_summary',p.signal_summary,
    'signal_observed_at',extract(epoch from p.signal_observed_at),'service_line',p.service_line);
$$;
revoke all on function public.chillbros_outreach_snapshot(public.chillbros_revenue_prospects) from public,anon,authenticated;
grant execute on function public.chillbros_outreach_snapshot(public.chillbros_revenue_prospects) to service_role;
