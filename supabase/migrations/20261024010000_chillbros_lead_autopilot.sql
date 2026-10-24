-- Lead Autopilot: inbound lead capture, self-booking, and capacity-throttled outreach.
-- Additive only. All tables are server-only (service role); RLS on with no policies.

create table if not exists public.chillbros_autopilot_settings (
  id smallint primary key default 1 check (id = 1),
  -- Master switch and per-lane switches.
  enabled boolean not null default true,
  inbound_enabled boolean not null default true,
  reactivation_enabled boolean not null default true,
  cold_email_enabled boolean not null default false,
  -- Booking capacity: weekday hours (Central), slot length, jobs per slot (null = active technicians).
  workday_start text not null default '08:00',
  workday_end text not null default '17:00',
  saturday_start text,
  saturday_end text,
  slot_minutes integer not null default 120 check (slot_minutes between 30 and 480),
  jobs_per_slot integer check (jobs_per_slot between 1 and 20),
  booking_days_ahead integer not null default 7 check (booking_days_ahead between 1 and 30),
  min_lead_hours integer not null default 3 check (min_lead_hours between 0 and 72),
  -- Outreach throttle.
  cold_daily_cap integer not null default 15 check (cold_daily_cap between 0 and 500),
  reactivation_daily_cap integer not null default 40 check (reactivation_daily_cap between 0 and 500),
  sends_per_open_slot integer not null default 10 check (sends_per_open_slot between 1 and 100),
  -- Playbook inputs the sales brain uses.
  residential_service_fee text,
  commercial_service_fee text,
  hood_cleaning_active boolean not null default true,
  allow_reference_customers boolean not null default false,
  sender_postal_address text not null default 'Chill Professionals LLC, 15226 Preston Pass, San Antonio, TX 78247',
  updated_at timestamptz not null default now()
);
insert into public.chillbros_autopilot_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.chillbros_inbound_leads (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  source text not null default 'website',
  name text,
  email text,
  phone text,
  address text,
  property_type text check (property_type in ('residential', 'commercial')),
  service_line text,
  message text,
  urgency text not null default 'routine' check (urgency in ('routine', 'urgent', 'emergency')),
  status text not null default 'new' check (status in ('new', 'contacted', 'booked', 'lost', 'suppressed')),
  ai_reply text,
  customer_id uuid references public.chillbros_customers(id) on delete set null,
  job_id uuid references public.chillbros_jobs(id) on delete set null,
  prospect_id uuid references public.chillbros_revenue_prospects(id) on delete set null,
  first_reply_at timestamptz,
  last_touch_at timestamptz,
  touch_count integer not null default 0,
  booked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chillbros_inbound_leads_status_idx on public.chillbros_inbound_leads (status, last_touch_at);
create index if not exists chillbros_inbound_leads_email_idx on public.chillbros_inbound_leads (lower(email));

create table if not exists public.chillbros_outreach_log (
  id uuid primary key default gen_random_uuid(),
  lane text not null check (lane in ('inbound', 'reactivation', 'cold', 'booking', 'enrichment')),
  step integer not null default 0,
  channel text not null check (channel in ('email', 'sms', 'none')),
  recipient text,
  prospect_id uuid references public.chillbros_revenue_prospects(id) on delete set null,
  customer_id uuid references public.chillbros_customers(id) on delete set null,
  inbound_lead_id uuid references public.chillbros_inbound_leads(id) on delete set null,
  subject text,
  body text,
  status text not null check (status in ('sent', 'failed', 'skipped', 'configuration_required', 'dry_run')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists chillbros_outreach_log_lane_idx on public.chillbros_outreach_log (lane, created_at desc);
create index if not exists chillbros_outreach_log_prospect_idx on public.chillbros_outreach_log (prospect_id, created_at desc);
create index if not exists chillbros_outreach_log_customer_idx on public.chillbros_outreach_log (customer_id, created_at desc);

create table if not exists public.chillbros_outreach_suppressions (
  contact text primary key, -- lowercased email or E.164 phone
  reason text not null default 'unsubscribed',
  created_at timestamptz not null default now()
);

-- Prospect sequence state (additive columns on the existing Revenue Radar table).
alter table public.chillbros_revenue_prospects
  add column if not exists outreach_step integer not null default 0,
  add column if not exists outreach_last_at timestamptz,
  add column if not exists outreach_done boolean not null default false,
  add column if not exists email_enriched_at timestamptz;

alter table public.chillbros_autopilot_settings enable row level security;
alter table public.chillbros_inbound_leads enable row level security;
alter table public.chillbros_outreach_log enable row level security;
alter table public.chillbros_outreach_suppressions enable row level security;
