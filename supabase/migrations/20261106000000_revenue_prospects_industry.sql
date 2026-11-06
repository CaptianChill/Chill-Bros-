-- Industry tag on Revenue Radar prospects so the call list can pinpoint auto openings
-- (car washes, oil change, collision, dealership service shops) separately from food.
alter table public.chillbros_revenue_prospects add column if not exists industry text;
do $$ begin
  alter table public.chillbros_revenue_prospects add constraint chillbros_revenue_prospects_industry_check check (industry is null or industry in ('food','auto','retail','medical','other'));
exception when duplicate_object then null; end $$;
create index if not exists chillbros_revenue_prospects_industry_idx on public.chillbros_revenue_prospects (industry) where industry is not null;
-- leadbiz_public_stats(): 'openings' now excludes auto (the New Openings packs are food/retail); adds 'auto'.
