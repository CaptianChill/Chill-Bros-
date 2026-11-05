-- Lead Buyers tab: licensed SA-area contractors from Texas state license lists, refreshed daily
-- by the leadbiz cron (lib/chillbros/leadbiz/runner.ts refreshContractors).
create table if not exists public.chillbros_leadbiz_contractors (
  license text primary key,
  trade text not null,
  name text not null,
  phone text,
  address text,
  contact text,
  source text not null,
  refreshed_at timestamptz not null default now()
);
create index if not exists chillbros_leadbiz_contractors_trade_idx on public.chillbros_leadbiz_contractors (trade, name);
alter table public.chillbros_leadbiz_contractors enable row level security;
