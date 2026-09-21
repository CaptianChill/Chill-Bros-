alter table public.chillbros_field_note_submissions
  add column if not exists invoice_description text;

comment on column public.chillbros_field_note_submissions.invoice_description
  is 'Owner-reviewed invoice wording; never automatically added to or sent with an invoice.';

notify pgrst, 'reload schema';
