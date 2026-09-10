create table if not exists public.chillbros_knowledge_cases (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.chillbros_jobs(id) on delete cascade,
  invoice_id uuid references public.chillbros_invoices(id) on delete set null,
  equipment_id uuid references public.chillbros_equipment(id) on delete set null,
  customer_id uuid references public.chillbros_customers(id) on delete set null,
  technician_id uuid references public.chillbros_profiles(id) on delete set null,
  source_type text not null default 'completed_job' check (source_type in ('completed_job','field_case','oem','manual','community')),
  equipment_type text,
  manufacturer text,
  model text,
  serial_number text,
  asset_tag text,
  complaint text,
  work_performed text,
  parts_used jsonb not null default '[]'::jsonb,
  readings jsonb not null default '[]'::jsonb,
  technical_notes text,
  verification_grade text not null default 'field' check (verification_grade in ('field','oem','trusted','community')),
  knowledge_status text not null default 'verified' check (knowledge_status in ('draft','verified','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id)
);

create index if not exists chillbros_knowledge_equipment_idx on public.chillbros_knowledge_cases(equipment_id);
create index if not exists chillbros_knowledge_customer_idx on public.chillbros_knowledge_cases(customer_id);
create index if not exists chillbros_knowledge_model_idx on public.chillbros_knowledge_cases(lower(model));
create index if not exists chillbros_knowledge_manufacturer_idx on public.chillbros_knowledge_cases(lower(manufacturer));
create index if not exists chillbros_knowledge_status_idx on public.chillbros_knowledge_cases(knowledge_status);

alter table public.chillbros_knowledge_cases enable row level security;
revoke all on table public.chillbros_knowledge_cases from public, anon, authenticated;
grant all on table public.chillbros_knowledge_cases to service_role;
