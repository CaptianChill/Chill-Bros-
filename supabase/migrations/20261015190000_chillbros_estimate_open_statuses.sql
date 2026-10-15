-- Let a quote or invoice be created from a job at any open stage
-- (on the way, on site, work done), not only while it is "scheduled" or
-- "in_progress". Techs were blocked from billing a job after tapping
-- "Mark work done" (2026-10-15). Rewrites only the job-status filter in the
-- live function definition; everything else in the function is unchanged.
-- Keep the list in step with ESTIMATE_OPEN_JOB_STATUSES in
-- lib/chillbros/estimate-actions-v2.ts.
do $migration$
declare
  v_def text;
  v_old text := $q$j.status in ('scheduled','in_progress')$q$;
  v_new text := $q$j.status in ('new','needs_scheduling','scheduled','in_progress','dispatched','en_route','arrived','diagnosing','awaiting_approval','approved','parts_required','return_visit_needed','repairing','work_complete','ready_to_invoice')$q$;
begin
  select pg_get_functiondef('public.chillbros_create_estimate_v2(uuid,text,text,jsonb,jsonb)'::regprocedure) into v_def;
  if position(v_new in v_def) > 0 then
    return; -- already applied
  end if;
  if position(v_old in v_def) = 0 then
    raise exception 'chillbros_create_estimate_v2: expected job status filter not found';
  end if;
  execute replace(v_def, v_old, v_new);
end
$migration$;
