alter table public.chillbros_equipment
  add column if not exists asset_tag text;

create unique index if not exists chillbros_equipment_asset_tag_unique_idx
  on public.chillbros_equipment (lower(asset_tag))
  where asset_tag is not null;

alter table public.chillbros_jobs
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists archived_reason text;

alter table public.chillbros_jobs
  drop constraint if exists chillbros_jobs_archived_by_fkey;
alter table public.chillbros_jobs
  add constraint chillbros_jobs_archived_by_fkey
  foreign key (archived_by) references public.chillbros_profiles(id);

create index if not exists chillbros_jobs_archived_at_idx on public.chillbros_jobs(archived_at);
create index if not exists chillbros_jobs_archived_by_idx on public.chillbros_jobs(archived_by);

create table if not exists public.chillbros_service_agreements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.chillbros_customers(id) on delete restrict,
  agreement_number text not null unique,
  portal_token uuid not null default gen_random_uuid() unique,
  title text not null default 'Custom Monthly Service Plan',
  status text not null default 'draft' check (status in ('draft','proposed','accepted','active','cancelled')),
  calculation_mode text not null default 'hourly' check (calculation_mode in ('hourly','flat')),
  visits_per_month integer not null default 1 check (visits_per_month between 1 and 31),
  hours_per_visit numeric(10,2) not null default 1 check (hours_per_visit >= 0 and hours_per_visit <= 24),
  hourly_rate numeric(12,2) not null default 0 check (hourly_rate >= 0 and hourly_rate <= 100000),
  monthly_flat_rate numeric(12,2) not null default 0 check (monthly_flat_rate >= 0 and monthly_flat_rate <= 1000000),
  preferred_days text[] not null default '{}'::text[],
  preferred_time_window text,
  start_date date,
  end_date date,
  services_included text,
  customer_preferences text,
  terms text,
  setup_fee numeric(12,2) not null default 0 check (setup_fee >= 0 and setup_fee <= 1000000),
  discount_type text check (discount_type is null or discount_type in ('percent','dollar')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  monthly_subtotal numeric(12,2) not null default 0 check (monthly_subtotal >= 0),
  monthly_total numeric(12,2) not null default 0 check (monthly_total >= 0),
  signature_name text,
  signed_at timestamptz,
  created_by uuid references public.chillbros_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chillbros_service_agreements_dates check (end_date is null or start_date is null or end_date >= start_date),
  constraint chillbros_service_agreements_signature check ((signed_at is null and signature_name is null) or (signed_at is not null and length(trim(signature_name)) >= 2))
);

create index if not exists chillbros_service_agreements_customer_idx on public.chillbros_service_agreements(customer_id);
create index if not exists chillbros_service_agreements_status_idx on public.chillbros_service_agreements(status);
create index if not exists chillbros_service_agreements_created_by_idx on public.chillbros_service_agreements(created_by);

alter table public.chillbros_service_agreements enable row level security;
revoke all on table public.chillbros_service_agreements from anon, authenticated;
grant all on table public.chillbros_service_agreements to service_role;
