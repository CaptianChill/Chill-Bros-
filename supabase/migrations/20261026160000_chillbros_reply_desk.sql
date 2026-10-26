-- Reply desk: the autopilot reads replies to its outreach emails and answers them.
-- Additive only. Server-only table (service role); RLS on with no policies.

alter table public.chillbros_autopilot_settings
  add column if not exists reply_enabled boolean not null default true;

alter table public.chillbros_outreach_log drop constraint if exists chillbros_outreach_log_lane_check;
alter table public.chillbros_outreach_log add constraint chillbros_outreach_log_lane_check
  check (lane in ('inbound', 'reactivation', 'cold', 'booking', 'enrichment', 'reply'));

create table if not exists public.chillbros_email_replies (
  id uuid primary key default gen_random_uuid(),
  -- The incoming email's Message-ID; each reply is handled once.
  message_id text not null unique,
  from_email text not null,
  subject text,
  received_at timestamptz,
  prospect_id uuid references public.chillbros_revenue_prospects(id) on delete set null,
  customer_id uuid references public.chillbros_customers(id) on delete set null,
  intent text,
  hot boolean not null default false,
  action text not null check (action in ('replied', 'handed_off', 'unsubscribed', 'stopped', 'ignored')),
  summary text,
  their_text text,
  our_reply text,
  created_at timestamptz not null default now()
);
create index if not exists chillbros_email_replies_from_idx on public.chillbros_email_replies (from_email, created_at desc);
alter table public.chillbros_email_replies enable row level security;
