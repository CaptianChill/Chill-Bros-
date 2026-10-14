-- Extra people to copy (CC) on customer emails: invoices, estimates,
-- reminders, receipts and job notices. Stored as "a@x.com, b@y.com".
-- The main `email` column stays a single address because Square checkout
-- pre-fills it as the buyer email. CC'd people can also sign in to /my.
alter table public.chillbros_customers add column if not exists cc_emails text;
alter table public.chillbros_customers drop constraint if exists chillbros_customers_cc_emails_len;
alter table public.chillbros_customers add constraint chillbros_customers_cc_emails_len check (cc_emails is null or char_length(cc_emails) <= 1000);
