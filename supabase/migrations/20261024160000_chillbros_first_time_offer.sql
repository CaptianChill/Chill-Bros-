-- New-customer offer used by Lead Autopilot messages and the booking page.
alter table public.chillbros_autopilot_settings add column if not exists first_time_offer text;
update public.chillbros_autopilot_settings set first_time_offer = '$99 first service call (normally $155)' where id = 1 and first_time_offer is null;
