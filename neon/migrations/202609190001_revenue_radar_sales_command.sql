-- Revenue Radar Sales Command Center P0 schema
-- Strictly additive migration for Neon/Postgres Data API compatibility.
-- Existing chillbros_revenue_prospects.status remains untouched for legacy workflow compatibility.

alter table public.chillbros_revenue_prospects
  add column if not exists sales_status text not null default 'new'
    check (sales_status in ('new','ready_to_call','contacted','qualified','technician_needed','appointment_set','proposal_requested','won','lost','nurture','do_not_contact')),
  add column if not exists priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  add column if not exists assigned_salesperson uuid references public.chillbros_profiles(id) on delete set null,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists do_not_contact_reason text,
  add column if not exists status_reason text,
  add column if not exists last_activity_at timestamptz;

create index if not exists chillbros_revenue_sales_pipeline_idx
  on public.chillbros_revenue_prospects(sales_status, assigned_salesperson, priority, score desc);

create table if not exists public.chillbros_revenue_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.chillbros_revenue_prospects(id) on delete cascade,
  name text,
  role text,
  phone text,
  email text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','customer_reported','source_verified','verified')),
  source text,
  preferred_contact_method text,
  is_primary boolean not null default false,
  do_not_contact boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chillbros_revenue_contacts_lead_idx
  on public.chillbros_revenue_contacts(lead_id, is_primary desc, created_at);

create table if not exists public.chillbros_revenue_battle_cards (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.chillbros_revenue_prospects(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  prompt_version text not null,
  generation_trigger text not null,
  generated_by uuid references public.chillbros_profiles(id) on delete set null,
  is_current boolean not null default true,
  superseded_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists chillbros_revenue_one_current_battle_card
  on public.chillbros_revenue_battle_cards(lead_id) where is_current;

create table if not exists public.chillbros_revenue_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.chillbros_revenue_prospects(id) on delete cascade,
  salesperson_id uuid references public.chillbros_profiles(id) on delete set null,
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
create index if not exists chillbros_revenue_activities_lead_idx
  on public.chillbros_revenue_activities(lead_id, created_at desc);

create table if not exists public.chillbros_revenue_handoffs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.chillbros_revenue_prospects(id) on delete cascade,
  activity_id uuid references public.chillbros_revenue_activities(id) on delete set null,
  salesperson_id uuid references public.chillbros_profiles(id) on delete set null,
  assigned_technician uuid references public.chillbros_profiles(id) on delete set null,
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
create index if not exists chillbros_revenue_handoffs_status_idx
  on public.chillbros_revenue_handoffs(status, created_at);
create index if not exists chillbros_revenue_handoffs_lead_idx
  on public.chillbros_revenue_handoffs(lead_id, status, created_at desc);

create table if not exists public.chillbros_revenue_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.chillbros_revenue_prospects(id) on delete cascade,
  activity_id uuid references public.chillbros_revenue_activities(id) on delete set null,
  handoff_id uuid references public.chillbros_revenue_handoffs(id) on delete set null,
  assigned_user uuid references public.chillbros_profiles(id) on delete set null,
  created_by uuid references public.chillbros_profiles(id) on delete set null,
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
create index if not exists chillbros_revenue_tasks_due_idx
  on public.chillbros_revenue_tasks(status, due_at);
create index if not exists chillbros_revenue_tasks_lead_idx
  on public.chillbros_revenue_tasks(lead_id, status, due_at);

create table if not exists public.chillbros_revenue_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.chillbros_revenue_prospects(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_id uuid references public.chillbros_profiles(id) on delete set null,
  actor_type text not null default 'user',
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists chillbros_revenue_history_lead_idx
  on public.chillbros_revenue_history(lead_id, created_at desc);

create or replace function public.chillbros_revenue_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only; create an amendment/history record instead', TG_TABLE_NAME;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'chillbros_revenue_activities_append_only') then
    create trigger chillbros_revenue_activities_append_only
      before update or delete on public.chillbros_revenue_activities
      for each row execute function public.chillbros_revenue_reject_mutation();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'chillbros_revenue_history_append_only') then
    create trigger chillbros_revenue_history_append_only
      before update or delete on public.chillbros_revenue_history
      for each row execute function public.chillbros_revenue_reject_mutation();
  end if;
end;
$$;

alter table public.chillbros_revenue_contacts enable row level security;
alter table public.chillbros_revenue_battle_cards enable row level security;
alter table public.chillbros_revenue_activities enable row level security;
alter table public.chillbros_revenue_handoffs enable row level security;
alter table public.chillbros_revenue_tasks enable row level security;
alter table public.chillbros_revenue_history enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.chillbros_revenue_contacts, public.chillbros_revenue_battle_cards, public.chillbros_revenue_activities, public.chillbros_revenue_handoffs, public.chillbros_revenue_tasks, public.chillbros_revenue_history from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.chillbros_revenue_contacts, public.chillbros_revenue_battle_cards, public.chillbros_revenue_activities, public.chillbros_revenue_handoffs, public.chillbros_revenue_tasks, public.chillbros_revenue_history from authenticated;
  end if;
end;
$$;

comment on column public.chillbros_revenue_prospects.sales_status is 'Canonical Revenue Radar sales pipeline status. Legacy status column is preserved during rollout.';
comment on table public.chillbros_revenue_activities is 'Append-only sales interaction records. Customer statements are customer-reported, not technical findings.';
comment on table public.chillbros_revenue_handoffs is 'Technical escalation from sales. customer_reported_problem is not a diagnosis.';
comment on table public.chillbros_revenue_history is 'Append-only audit history for Revenue Radar Sales Command Center.';
