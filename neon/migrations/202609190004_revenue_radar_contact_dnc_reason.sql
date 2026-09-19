-- Contact-level Do Not Contact evidence.

alter table public.chillbros_revenue_contacts
  add column if not exists do_not_contact_reason text;

comment on column public.chillbros_revenue_contacts.do_not_contact_reason is
  'Recorded source/reason for a contact-specific Do Not Contact restriction.';
