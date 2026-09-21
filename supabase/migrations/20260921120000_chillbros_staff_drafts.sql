create table if not exists public.chillbros_staff_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.chillbros_profiles(id) on delete cascade,
  owner_auth_user_id uuid,
  draft_key text not null,
  path text not null,
  label text not null,
  customer_id uuid references public.chillbros_customers(id) on delete set null,
  form_index integer not null default 0,
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chillbros_staff_drafts_owner_key unique (owner_profile_id, draft_key)
);

create index if not exists chillbros_staff_drafts_owner_idx on public.chillbros_staff_drafts(owner_profile_id);
create index if not exists chillbros_staff_drafts_customer_idx on public.chillbros_staff_drafts(customer_id) where customer_id is not null;

alter table public.chillbros_staff_drafts enable row level security;
revoke all on table public.chillbros_staff_drafts from anon, authenticated;
