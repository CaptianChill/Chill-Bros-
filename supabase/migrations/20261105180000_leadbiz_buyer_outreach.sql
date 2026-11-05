-- Lead business ("San Antonio New Openings"): contractor buyers we email the lead-pack offer to.
-- Separate from chillbros_revenue_prospects (Chill Pros' own customers). Service role only.
create table if not exists public.chillbros_leadbiz_buyers (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  trade text not null check (trade in ('plumbing','electrical','hood_cleaning','pest_control','commercial_cleaning','signs','low_voltage','security')),
  email text,
  phone text,
  website text,
  address text,
  source_url text not null unique,
  status text not null default 'new' check (status in ('new','no_email','ready','emailed','followed_up','replied','unsubscribed','bounced','skipped')),
  enriched_at timestamptz,
  emailed_at timestamptz,
  followup_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists chillbros_leadbiz_buyers_email_idx
  on public.chillbros_leadbiz_buyers (lower(email)) where email is not null;
create index if not exists chillbros_leadbiz_buyers_status_idx on public.chillbros_leadbiz_buyers (status, trade);

alter table public.chillbros_leadbiz_buyers enable row level security;
