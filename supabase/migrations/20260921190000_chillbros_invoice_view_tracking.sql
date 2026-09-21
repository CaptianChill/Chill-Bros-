alter table public.chillbros_invoices
  add column if not exists first_viewed_at timestamptz;
