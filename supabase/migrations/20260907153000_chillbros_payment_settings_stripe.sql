create table if not exists public.chillbros_payment_settings (
  id text primary key default 'default',
  stripe_enabled boolean not null default false,
  zelle_contact text,
  cash_app_handle text,
  venmo_handle text,
  check_payable_to text,
  manual_ach_instructions text,
  customer_payment_note text,
  updated_by uuid references public.chillbros_profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint chillbros_payment_settings_singleton check (id = 'default')
);

insert into public.chillbros_payment_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.chillbros_payment_settings enable row level security;
revoke all on table public.chillbros_payment_settings from anon, authenticated;

alter table public.chillbros_invoices
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_payment_status text;

create unique index if not exists chillbros_invoices_stripe_checkout_session_uidx
  on public.chillbros_invoices(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists chillbros_invoices_stripe_payment_intent_idx
  on public.chillbros_invoices(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
