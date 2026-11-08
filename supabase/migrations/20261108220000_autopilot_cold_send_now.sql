-- Owner "send now": cold email skips its best-time window until this moment.
alter table public.chillbros_autopilot_settings add column if not exists cold_send_now_until timestamptz;
