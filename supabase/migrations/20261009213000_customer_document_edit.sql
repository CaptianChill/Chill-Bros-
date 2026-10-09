-- Save document prices, equipment and field notes in one transaction.
-- Only the server service role may execute; the action requires manager auth.
create or replace function public.chillbros_manager_edit_document(
  p_invoice_id uuid, p_notes text, p_line_items jsonb,
  p_equipment_id uuid, p_work_performed text,
  p_update_equipment boolean, p_update_work boolean
) returns void language plpgsql set search_path = '' as $$
declare
  v_invoice public.chillbros_invoices%rowtype;
  v_job public.chillbros_jobs%rowtype;
  v_unit_customer uuid;
begin
  select * into v_invoice from public.chillbros_invoices
    where id = p_invoice_id and revoked_at is null
      and status in ('draft', 'awaiting_approval') and payment_status <> 'paid'
    for update;
  if not found then raise exception 'Document is not editable. Reopen an unpaid approved document first.'; end if;
  if p_update_work and length(coalesce(p_work_performed, '')) > 6000 then
    raise exception 'On-site notes must be 6,000 characters or fewer.';
  end if;
  if v_invoice.job_id is not null then
    select * into v_job from public.chillbros_jobs where id = v_invoice.job_id for update;
    if not found or v_job.customer_id <> v_invoice.customer_id then raise exception 'Linked service call does not match this customer.'; end if;
    if p_update_equipment and p_equipment_id is not null then
      select customer_id into v_unit_customer from public.chillbros_equipment where id = p_equipment_id for share;
      if not found or v_unit_customer <> v_job.customer_id then raise exception 'Selected equipment does not belong to this customer.'; end if;
    end if;
  elsif (p_update_equipment and p_equipment_id is not null) or (p_update_work and nullif(btrim(p_work_performed), '') is not null) then
    raise exception 'A linked service call is required for equipment and on-site notes.';
  end if;
  perform public.chillbros_manager_replace_estimate_lines(p_invoice_id, p_notes, p_line_items);
  if v_invoice.job_id is not null and (p_update_equipment or p_update_work) then
    update public.chillbros_jobs set
      equipment_id = case when p_update_equipment then p_equipment_id else equipment_id end,
      work_performed = case when p_update_work then nullif(btrim(p_work_performed), '') else work_performed end,
      updated_at = now()
    where id = v_invoice.job_id;
  end if;
end;
$$;
revoke all on function public.chillbros_manager_edit_document(uuid,text,jsonb,uuid,text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.chillbros_manager_edit_document(uuid,text,jsonb,uuid,text,boolean,boolean) to service_role;
