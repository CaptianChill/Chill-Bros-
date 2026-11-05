-- One row per cron run (what was found/sent, or the error), readable without log access.
create table if not exists public.chillbros_leadbiz_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  result jsonb not null
);
alter table public.chillbros_leadbiz_runs enable row level security;
