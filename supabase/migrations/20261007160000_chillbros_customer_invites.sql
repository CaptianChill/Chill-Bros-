-- Personal sign-up links for existing customers. Only 9 of 50 customer records
-- have an email, so email matching alone can't connect most customers to their
-- history. An invite link proves which customer record the person belongs to;
-- after they verify any email with a one-time code, that record is linked to
-- their account (and the email is saved on the record if it had none).
-- token_hash = sha256 hex of a 32-byte random token. Reusable until expiry so
-- several people at one business can use the same link.
create table if not exists public.chillbros_customer_invites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.chillbros_customers(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '90 days',
  revoked_at timestamptz,
  last_used_at timestamptz,
  use_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists chillbros_customer_invites_customer_idx on public.chillbros_customer_invites(customer_id);
alter table public.chillbros_customer_invites enable row level security;
