-- Technician Work Page: per-part field status + notes on chillbros_job_parts.
-- Additive only. Existing rows keep field_status = NULL (the app shows NULL as
-- "On truck"); only rows inserted after this migration get the 'on_truck'
-- default. Adding the column first WITHOUT a default and setting the default
-- afterwards is what keeps existing rows NULL (no backfill).

alter table public.chillbros_job_parts
  add column if not exists field_status text,
  add column if not exists notes text;

alter table public.chillbros_job_parts
  alter column field_status set default 'on_truck';

alter table public.chillbros_job_parts
  drop constraint if exists chillbros_job_parts_field_status_check;
alter table public.chillbros_job_parts
  add constraint chillbros_job_parts_field_status_check
  check (field_status is null or field_status in ('on_truck', 'need_to_order', 'ordered'));

alter table public.chillbros_job_parts
  drop constraint if exists chillbros_job_parts_notes_length_check;
alter table public.chillbros_job_parts
  add constraint chillbros_job_parts_notes_length_check
  check (notes is null or char_length(notes) <= 1000);

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- ROLLBACK (run manually only if this change must be undone; drops any part
-- statuses/notes entered since it was applied):
--
-- alter table public.chillbros_job_parts drop constraint if exists chillbros_job_parts_notes_length_check;
-- alter table public.chillbros_job_parts drop constraint if exists chillbros_job_parts_field_status_check;
-- alter table public.chillbros_job_parts drop column if exists notes;
-- alter table public.chillbros_job_parts drop column if exists field_status;
-- notify pgrst, 'reload schema';
