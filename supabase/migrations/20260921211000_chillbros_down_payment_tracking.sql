-- Down payment amount/type/value have existed on chillbros_invoices since the
-- estimate-v2 migration, but were purely informational: nothing tracked
-- whether a required down payment was actually collected, and it never
-- reduced the final invoice balance. This adds real collection tracking,
-- mirroring the existing payment_status/payment_method/paid_at/paid_recorded_by
-- columns used for full invoice payments.
alter table public.chillbros_invoices
  add column if not exists down_payment_status public.chillbros_payment_status not null default 'unpaid',
  add column if not exists down_payment_method public.chillbros_payment_method,
  add column if not exists down_payment_paid_at timestamptz,
  add column if not exists down_payment_recorded_by uuid references public.chillbros_profiles(id);
