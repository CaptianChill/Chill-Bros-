alter table public.chillbros_receipts
  add column if not exists payment_reference text,
  add column if not exists payer_name text,
  add column if not exists card_last4 text,
  add column if not exists payment_notes text;

alter table public.chillbros_receipts
  drop constraint if exists chillbros_receipts_payment_reference_length,
  add constraint chillbros_receipts_payment_reference_length check (payment_reference is null or char_length(payment_reference) <= 120),
  drop constraint if exists chillbros_receipts_payer_name_length,
  add constraint chillbros_receipts_payer_name_length check (payer_name is null or char_length(payer_name) <= 160),
  drop constraint if exists chillbros_receipts_card_last4_format,
  add constraint chillbros_receipts_card_last4_format check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  drop constraint if exists chillbros_receipts_payment_notes_length,
  add constraint chillbros_receipts_payment_notes_length check (payment_notes is null or char_length(payment_notes) <= 1000);
