-- Revenue Radar Sales Command Center P0 schema
-- Additive only. Designed for Neon/Postgres Data API compatibility.

alter table public.chillbros_revenue_prospects
  add column if not exists priority text not null default 'normal',
  add column if not exists assigned_salesperson uuid,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists do_not_contact_reason text,
  add column if not exists last_activity_at timestamptz;

create table if not exists public.chillbros_revenue_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.chillbros_revenue_prospects(id) on delete cascade,
  name text,
  role text,
  phone text,
  email text,
  verification_status text not null default 'unverified',
  source text,
  preferred_contact_method text,
  is_primary boolean not null default false,
  do_not_contact boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chillbros_revenue_battle_cards (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.chillbros_revenue_prospects(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  prompt_version text not null,
  generation_trigger text not null,
  generated_by uuid,
  is_current boolean not null default true,
  superseded_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists chillbros_revenue_one_current_battle_card
  on public.chillbros_revenue_battle_cards(lead_id) where is_current;

create table if not exists public.chillbros_revenue_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.chillbros_revenue_prospects(id) on delete cascade,
  salesperson_id uuid,
  activity_type text not null,
  call_outcome text,
  contacted_person text,
  contacted_role text,
  customer_statement text,
  need_identified text,
  equipment_mentioned text,
  current_vendor text,
  urgency text,
  next_step text,
  follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists chillbros_revenue_activities_lead_idx on public.chillbros_revenue_activities(lead_id, created_at desc);

create table if not exists public.chillbros_revenue_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.chillbros_revenue_prospects(id) on delete cascade,
  activity_id uuid references public.chillbros_revenue_activities(id),
  assigned_user uuid,
  created_by uuid,
  task_type text not null,
  description text not null,
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open','in_progress','completed','canceled','overdue')),
  completion_notes text,
  cancellation_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chillbros_revenue_tasks_due_idx on public.chillbros_revenue_tasks(status, due_at);

create table if not exists public.chillbros_revenue_handoffs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.chillbros_revenue_prospects(id) on delete cascade,
  activity_id uuid references public.chillbros_revenue_activities(id),
  salesperson_id uuid,
  assigned_technician uuid,
  customer_contact text,
  equipment_type text,
  customer_reported_problem text not null,
  problem_started_at text,
  equipment_status text,
  business_impact text,
  urgency text not null,
  site_access text,
  best_contact text,
  permission_to_follow_up boolean not null default false,
  status text not null default 'received' check (status in ('draft','received','accepted','scheduled','completed','declined')),
  decline_reason text,
  resolution text,
  technical_notes text,
  accepted_at timestamptz,
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chillbros_revenue_handoffs_status_idx on public.chillbros_revenue_handoffs(status, created_at);

create table if not exists public.chillbros_revenue_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.chillbros_revenue_prospects(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_id uuid,
  actor_type text not null default 'user',
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists chillbros_revenue_history_lead_idx on public.chillbros_revenue_history(lead_id, created_at desc);

comment on table public.chillbros_revenue_activities is 'Append-only sales interaction records. Customer statements are customer-reported, not technical findings.';
comment on table public.chillbros_revenue_handoffs is 'Technical escalation from sales. customer_reported_problem is not a diagnosis.';
comment on table public.chillbros_revenue_history is 'Append-only audit history for Revenue Radar Sales Command Center.';
