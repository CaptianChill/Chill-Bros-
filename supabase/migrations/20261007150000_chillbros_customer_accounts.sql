-- Customer accounts for the customer homepage (/my).
-- Customers sign in with a one-time email code (no passwords). An account is
-- linked to every existing chillbros_customers row whose email matches the
-- verified email, so existing customers see their history right away.
-- Server-only tables: RLS on, no policies; accessed with the service role.

create table if not exists public.chillbros_customer_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email))),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.chillbros_customer_account_links (
  account_id uuid not null references public.chillbros_customer_accounts(id) on delete cascade,
  customer_id uuid not null references public.chillbros_customers(id) on delete cascade,
  linked_at timestamptz not null default now(),
  link_source text not null default 'email_match',
  primary key (account_id, customer_id)
);
create index if not exists chillbros_customer_account_links_customer_idx on public.chillbros_customer_account_links(customer_id);

create table if not exists public.chillbros_customer_login_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists chillbros_customer_login_codes_email_idx on public.chillbros_customer_login_codes(email, created_at desc);

create table if not exists public.chillbros_customer_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.chillbros_customer_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists chillbros_customer_sessions_account_idx on public.chillbros_customer_sessions(account_id);

alter table public.chillbros_customer_accounts enable row level security;
alter table public.chillbros_customer_account_links enable row level security;
alter table public.chillbros_customer_login_codes enable row level security;
alter table public.chillbros_customer_sessions enable row level security;
