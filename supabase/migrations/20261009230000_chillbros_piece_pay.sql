-- Technician piece pay: each staff member is paid hourly or by the piece
-- (a share of what the company keeps on a job after parts and materials).
-- One saved pay record per invoice + technician, approved by the owner and
-- later marked paid. Applied to production 2026-10-09.

create table if not exists public.chillbros_tech_pay_settings (
  profile_id uuid primary key references public.chillbros_profiles(id) on delete cascade,
  pay_type text not null default 'hourly',
  piece_rate numeric(5,4) not null default 0.25,
  updated_by uuid references public.chillbros_profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint chillbros_tech_pay_settings_type check (pay_type in ('hourly', 'piece')),
  constraint chillbros_tech_pay_settings_rate check (piece_rate >= 0 and piece_rate <= 1)
);

create table if not exists public.chillbros_piece_pay (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.chillbros_invoices(id) on delete cascade,
  job_id uuid references public.chillbros_jobs(id) on delete set null,
  technician_id uuid not null references public.chillbros_profiles(id),
  revenue numeric(12,2) not null,
  cost_total numeric(12,2) not null default 0,
  kept numeric(12,2) not null,
  rate numeric(5,4) not null,
  calculated_pay numeric(12,2) not null,
  pay_amount numeric(12,2) not null,
  line_costs jsonb not null default '[]'::jsonb,
  is_callback boolean not null default false,
  notes text,
  status text not null default 'approved',
  approved_by uuid references public.chillbros_profiles(id) on delete set null,
  approved_at timestamptz not null default now(),
  paid_at timestamptz,
  paid_by uuid references public.chillbros_profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint chillbros_piece_pay_status check (status in ('approved', 'paid')),
  constraint chillbros_piece_pay_amounts check (revenue between 0 and 250000 and cost_total between 0 and 250000 and pay_amount between 0 and 50000 and rate between 0 and 1),
  constraint chillbros_piece_pay_notes check (notes is null or length(notes) <= 1000),
  unique (invoice_id, technician_id)
);
create index if not exists chillbros_piece_pay_tech_idx on public.chillbros_piece_pay(technician_id, status, approved_at desc);

alter table public.chillbros_tech_pay_settings enable row level security;
alter table public.chillbros_piece_pay enable row level security;
revoke all on table public.chillbros_tech_pay_settings from public, anon, authenticated;
revoke all on table public.chillbros_piece_pay from public, anon, authenticated;
grant all on table public.chillbros_tech_pay_settings to service_role;
grant all on table public.chillbros_piece_pay to service_role;

-- Owner's standing choice: Eric Lara (lead technician) is paid by the piece at 25%.
insert into public.chillbros_tech_pay_settings (profile_id, pay_type, piece_rate)
select id, 'piece', 0.25 from public.chillbros_profiles where full_name = 'Eric Lara'
on conflict (profile_id) do update set pay_type = 'piece', piece_rate = 0.25, updated_at = now();

notify pgrst, 'reload schema';
