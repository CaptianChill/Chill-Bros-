-- Adds Rosella Coffee (a.k.a. Rosella Quality Products) to the LIVE Supabase
-- project (bbb-sports-intelligence, xespxlqcjvhompsxranc) — see
-- docs/database-source-of-truth.md. Old Jobber customer that never transferred.
--
-- This CRM has no separate "locations" table, so each store is its own
-- chillbros_customers row under the shared "Rosella - " name prefix.
-- Idempotent: re-running will not create duplicates.
-- Customer notes, historical rates and invoice history are in
-- docs/rosella-customer-import.md (no notes column is assumed here).

insert into public.chillbros_customers (name, phone, email, address)
select v.name, v.phone, v.email, v.address
from (values
  ('Rosella - Main',
   '210-884-7189', 'julia@rosellacoffee.com',
   '10401 Mount Marcy, San Antonio, TX 78213'),
  ('Rosella - Methodist Stone Oak',
   '210-884-7189', 'julia@rosellacoffee.com',
   '1139 East Sonterra Boulevard, San Antonio, TX 78258'),
  ('Rosella - Methodist Northeast',
   '210-884-7189', 'julia@rosellacoffee.com',
   '12412 Judson Road, Live Oak, TX 78233')
) as v(name, phone, email, address)
where not exists (
  select 1 from public.chillbros_customers c where c.name = v.name
);
