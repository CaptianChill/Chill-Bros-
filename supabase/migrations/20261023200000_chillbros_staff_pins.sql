-- Staff sign in with their name + a 4-digit PIN the owner sets.
-- PINs are stored only as salted scrypt hashes, in their own table that only
-- the server (service role) can touch, so no page or client query can ever
-- read them. Ten wrong PINs in a row lock that PIN until the owner sets a new one.
create table if not exists public.chillbros_staff_pins (
  profile_id uuid primary key references public.chillbros_profiles(id) on delete cascade,
  pin_hash text not null,
  failed_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.chillbros_staff_pins enable row level security;

drop policy if exists "server service role only" on public.chillbros_staff_pins;
create policy "server service role only" on public.chillbros_staff_pins
  for all to service_role using (true) with check (true);

revoke all on public.chillbros_staff_pins from anon, authenticated;
