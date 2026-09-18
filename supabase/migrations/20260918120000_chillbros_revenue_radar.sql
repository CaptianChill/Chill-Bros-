create table if not exists public.chillbros_revenue_prospects (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  city text not null default 'San Antonio',
  category text not null check (category in ('equipment_failure','property_manager','opening_remodel','supplier_referral','other')),
  service_line text not null check (service_line in ('hvac_r','refrigeration','ice_machine','kitchen_equipment','exhaust_hood','multiple')),
  signal_summary text not null,
  source_url text not null,
  signal_observed_at timestamptz not null,
  signal_verified boolean not null default false,
  normalized_key text not null unique,
  score integer not null check (score between 0 and 100),
  status text not null default 'new' check (status in ('new','research','approved','skipped','contacted','quoted','won','lost')),
  contact_name text,
  contact_role text,
  contact_email text,
  contact_phone text,
  email_subject text,
  email_draft text,
  business_address text,
  sender_postal_address text,
  unsubscribe_instructions text,
  follow_up_at timestamptz,
  follow_up_note text,
  job_id uuid,
  invoice_id uuid,
  estimated_revenue numeric(12,2),
  actual_revenue numeric(12,2),
  direct_cost numeric(12,2),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chillbros_revenue_prospects_priority_idx on public.chillbros_revenue_prospects (status, score desc, signal_observed_at desc);
alter table public.chillbros_revenue_prospects enable row level security;
revoke all on public.chillbros_revenue_prospects from anon, authenticated;
comment on table public.chillbros_revenue_prospects is 'Office-reviewed prospect signals; server actions enforce manager or office access. No autonomous outreach.';
