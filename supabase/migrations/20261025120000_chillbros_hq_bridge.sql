-- Owner command center (Chill Pros HQ) bridge.
--
-- chillbros_hq_change_requests: app changes the owner asks for from the command center
--   (by voice/dictation). A scheduled Claude task builds and ships them, then marks them.
-- chillbros_hq_activity: permanent track record of everything done through the command
--   center (documents created, sent, reminders, questions, app changes shipped). This is the
--   proof log for showing how the software runs the business.
--
-- Both are server-only: RLS on, no policies, read/written with the service role.

create table if not exists public.chillbros_hq_change_requests (
  id uuid primary key default gen_random_uuid(),
  request text not null check (char_length(request) between 3 and 4000),
  status text not null default 'pending' check (status in ('pending', 'building', 'shipped', 'needs_you', 'declined')),
  result text,
  pr_url text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists chillbros_hq_change_requests_status_idx on public.chillbros_hq_change_requests (status, created_at);
alter table public.chillbros_hq_change_requests enable row level security;

create table if not exists public.chillbros_hq_activity (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('question', 'quote_created', 'invoice_created', 'document_sent', 'reminder_sent', 'change_requested', 'change_shipped', 'change_needs_you')),
  summary text not null check (char_length(summary) <= 1000),
  amount numeric(12, 2),
  ref_id text,
  minutes_saved integer not null default 0 check (minutes_saved between 0 and 600)
);
create index if not exists chillbros_hq_activity_created_idx on public.chillbros_hq_activity (created_at desc);
create index if not exists chillbros_hq_activity_kind_idx on public.chillbros_hq_activity (kind, created_at desc);
alter table public.chillbros_hq_activity enable row level security;

revoke all on public.chillbros_hq_change_requests from anon, authenticated;
revoke all on public.chillbros_hq_activity from anon, authenticated;
