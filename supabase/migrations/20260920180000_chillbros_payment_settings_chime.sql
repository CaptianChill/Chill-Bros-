alter table public.chillbros_payment_settings
  add column if not exists chime_handle text,
  add column if not exists check_mailing_address text;
