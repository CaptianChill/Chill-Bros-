-- Revenue Radar appointment evidence fields.
-- Additive only; required before a lead can enter Appointment Set.

alter table public.chillbros_revenue_activities
  add column if not exists appointment_at timestamptz,
  add column if not exists appointment_location text,
  add column if not exists appointment_type text,
  add column if not exists appointment_confirmed boolean not null default false;

create index if not exists chillbros_revenue_activities_appointment_idx
  on public.chillbros_revenue_activities(appointment_at)
  where appointment_at is not null;

comment on column public.chillbros_revenue_activities.appointment_confirmed is
  'Human-confirmed customer appointment; AI generation alone may never set this true.';
