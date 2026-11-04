-- Sales Prep: remembers which leads already had a Google Places contact lookup,
-- so each lead is looked up at most once.
alter table public.chillbros_revenue_prospects add column if not exists places_checked_at timestamptz;
