-- Technician Work Page: on-site customer sign-off captured by the technician.
-- Deliberately separate from the estimate/invoice signature fields on
-- chillbros_invoices (signature_name / signed_at), which stay the customer's
-- own portal approval. Signature PNGs live in the private `chillbros-media`
-- bucket under `signatures/<job_id>/...`, signed URLs only. storage_path is
-- NULL when the customer was unavailable to sign.

create table if not exists public.chillbros_job_signatures (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.chillbros_jobs(id) on delete restrict,
  signer_name text,
  storage_path text,
  customer_unavailable boolean not null default false,
  captured_by uuid references public.chillbros_profiles(id) on delete set null,
  captured_at timestamptz not null default now(),
  constraint chillbros_job_signatures_path_check check (storage_path is null or storage_path like 'signatures/%'),
  constraint chillbros_job_signatures_name_length check (signer_name is null or char_length(signer_name) <= 200),
  -- Either a real signature (name + image) or an explicit "customer unavailable".
  constraint chillbros_job_signatures_complete check (
    customer_unavailable or (signer_name is not null and storage_path is not null)
  )
);

create index if not exists chillbros_job_signatures_job_idx on public.chillbros_job_signatures(job_id, captured_at desc);

alter table public.chillbros_job_signatures enable row level security;
revoke all on table public.chillbros_job_signatures from anon, authenticated;
drop policy if exists "server service role only" on public.chillbros_job_signatures;
create policy "server service role only" on public.chillbros_job_signatures
  for all to service_role using (true) with check (true);

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- ROLLBACK (drops every captured on-site signature row; storage objects under
-- chillbros-media/signatures/ are not removed by this):
--
-- drop table if exists public.chillbros_job_signatures;
-- notify pgrst, 'reload schema';
