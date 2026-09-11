create table if not exists public.chillbros_diagnostic_readings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.chillbros_jobs(id) on delete cascade,
  equipment_id uuid references public.chillbros_equipment(id) on delete set null,
  technician_id uuid references public.chillbros_profiles(id) on delete set null,
  category text not null check (category in ('hvac','refrigeration','cooking','electrical','general')),
  readings jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists chillbros_diagnostic_readings_job_idx on public.chillbros_diagnostic_readings(job_id, created_at desc);
create index if not exists chillbros_diagnostic_readings_equipment_idx on public.chillbros_diagnostic_readings(equipment_id, created_at desc);
alter table public.chillbros_diagnostic_readings enable row level security;
revoke all on table public.chillbros_diagnostic_readings from public, anon, authenticated;
grant all on table public.chillbros_diagnostic_readings to service_role;