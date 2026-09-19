-- Technician handoff scheduling evidence.
-- Required to distinguish a real scheduled technical visit from a vague follow-up.

alter table public.chillbros_revenue_handoffs
  add column if not exists scheduled_location text;

comment on column public.chillbros_revenue_handoffs.scheduled_location is
  'Confirmed site location or remote method for scheduled technical follow-up.';
