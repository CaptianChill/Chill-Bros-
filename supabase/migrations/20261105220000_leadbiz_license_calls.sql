-- Buyer call list (standalone site /owner/call-list): call outcomes keyed by Texas TDLR license number.
-- The license list itself is fetched live from data.texas.gov; only the owner's call results are stored.
-- (Applied via MCP as migrations leadbiz_call_list + leadbiz_license_calls; see those for full bodies.)
create table if not exists public.chillbros_leadbiz_calls (
  license text primary key,
  business_name text,
  status text not null check (status in ('called','callback','interested','sold','not_interested','wrong_number')),
  note text,
  updated_at timestamptz not null default now()
);
alter table public.chillbros_leadbiz_calls enable row level security;
-- RPCs: leadbiz_owner_calls(p_key) and leadbiz_owner_mark_call(p_key, p_license, p_name, p_status, p_note),
-- security definer, same sha256 site-key check as leadbiz_owner_dashboard.
