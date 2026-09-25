-- Technician Work Page: INTERNAL job receipts (supply-house / parts receipts).
-- Never customer-facing: no portal, PDF, email, or invoice query selects this
-- table. Files live in the private `chillbros-media` bucket under
-- `receipts/<job_id>/...` and are only ever served through short-lived signed
-- URLs generated server-side.
--
-- Access model matches every other chillbros_* table on this project: RLS on,
-- no anon/authenticated access at all, the Next.js server uses the service
-- role and enforces "assigned technician or manager/office" in the server
-- actions. Only manager/office may set show_on_invoice (enforced server-side;
-- nothing reads it yet).
--
-- job_id uses ON DELETE RESTRICT on purpose: receipts are cost records, so a
-- hard job delete must not silently destroy them (jobs are normally archived,
-- not deleted).

create table if not exists public.chillbros_job_receipts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.chillbros_jobs(id) on delete restrict,
  storage_path text not null,
  vendor text,
  amount numeric(12,2),
  note text,
  created_by uuid references public.chillbros_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  show_on_invoice boolean not null default false,
  constraint chillbros_job_receipts_path_check check (storage_path like 'receipts/%'),
  constraint chillbros_job_receipts_amount_check check (amount is null or (amount >= 0 and amount < 1000000)),
  constraint chillbros_job_receipts_vendor_length check (vendor is null or char_length(vendor) <= 200),
  constraint chillbros_job_receipts_note_length check (note is null or char_length(note) <= 1000)
);

create index if not exists chillbros_job_receipts_job_idx on public.chillbros_job_receipts(job_id, created_at desc);

alter table public.chillbros_job_receipts enable row level security;
revoke all on table public.chillbros_job_receipts from anon, authenticated;
drop policy if exists "server service role only" on public.chillbros_job_receipts;
create policy "server service role only" on public.chillbros_job_receipts
  for all to service_role using (true) with check (true);

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- ROLLBACK (drops every receipt row; export first if any real receipts exist.
-- Storage objects under chillbros-media/receipts/ are NOT removed by this and
-- would need a separate, deliberate cleanup):
--
-- drop table if exists public.chillbros_job_receipts;
-- notify pgrst, 'reload schema';
