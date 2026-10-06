-- Legacy quotes may carry an issue date from the old in-place conversion.
create or replace function public.chillbros_owner_convert_quote(p_quote_id uuid, p_actor_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare q public.chillbros_invoices; n public.chillbros_invoices; num integer;
begin
  if not exists(select 1 from public.chillbros_profiles where id=p_actor_id and role='manager' and status='active') then
    raise exception 'Owner access required';
  end if;
  select * into q from public.chillbros_invoices where id=p_quote_id for update;
  if not found then raise exception 'Quote not found'; end if;
  if q.converted_invoice_id is not null then return q.converted_invoice_id; end if;
  if q.status <> 'approved' or q.revoked_at is not null or q.payment_status='paid' or (q.issued_at is not null and q.invoice_number not like 'Q-%') or q.source_quote_id is not null then
    raise exception 'Only an active approved unpaid quote or estimate can be converted';
  end if;
  -- Serialize number allocation with conversions and overrides.
  perform pg_advisory_xact_lock(hashtext('chillbros_owner_document_number'));
  select coalesce(max(substring(invoice_number from '^I-([0-9]+)$')::integer),0)+1 into num from public.chillbros_invoices;
  n := q;
  n.id := gen_random_uuid(); n.portal_token := gen_random_uuid();
  n.invoice_number := 'I-' || lpad(num::text, greatest(3,length(num::text)), '0');
  n.source_quote_id := q.id; n.converted_invoice_id := null;
  n.issued_at := now(); n.created_at := now(); n.updated_at := now();
  n.due_at := case when q.payment_terms='custom' then q.due_at else now() + make_interval(days => case q.payment_terms when 'net_7' then 7 when 'net_15' then 15 when 'net_30' then 30 else 0 end) end;
  n.payment_status := 'unpaid'; n.payment_method := null; n.paid_at := null; n.paid_recorded_by := null;
  n.last_reminder_at := null; n.reminder_count := 0; n.first_viewed_at := null;
  n.stripe_checkout_session_id := null; n.stripe_payment_intent_id := null; n.stripe_payment_status := null;
  update public.chillbros_invoices set converted_invoice_id=n.id where id=q.id;
  insert into public.chillbros_invoices select n.*;
  insert into public.chillbros_invoice_line_items(invoice_id,label,description,quantity,unit_price,amount,taxable,sort_order)
    select n.id,label,description,quantity,unit_price,amount,taxable,sort_order from public.chillbros_invoice_line_items where invoice_id=q.id;
  insert into public.chillbros_invoice_adjustments(invoice_id,adjustment_type,amount,reason,created_by)
    select n.id,adjustment_type,amount,reason,created_by from public.chillbros_invoice_adjustments where invoice_id=q.id;
  insert into public.chillbros_workflow_events(job_id,invoice_id,actor_id,stage,message)
    values(q.job_id,n.id,p_actor_id,'quote_converted_to_invoice','Owner converted ' || q.invoice_number || ' to ' || n.invoice_number || '. Original signed quote retained.');
  return n.id;
end $$;

revoke all on function public.chillbros_owner_convert_quote(uuid,uuid) from public,anon,authenticated;
grant execute on function public.chillbros_owner_convert_quote(uuid,uuid) to service_role;

create or replace function public.chillbros_owner_quote_to_estimate(p_quote_id uuid, p_actor_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare q public.chillbros_invoices; num integer; new_number text;
begin
  if not exists(select 1 from public.chillbros_profiles where id=p_actor_id and role='manager' and status='active') then raise exception 'Owner access required'; end if;
  select * into q from public.chillbros_invoices where id=p_quote_id for update;
  if not found then raise exception 'Quote not found'; end if;
  if q.invoice_number like 'E-%' and q.issued_at is null then return q.id; end if;
  if q.invoice_number not like 'Q-%' or q.revoked_at is not null or q.status='void' or q.payment_status='paid' or q.converted_invoice_id is not null then raise exception 'Only an active unconverted quote can become an estimate'; end if;
  perform pg_advisory_xact_lock(hashtext('chillbros_owner_document_number'));
  select coalesce(max(substring(invoice_number from '^E-([0-9]+)$')::integer),0)+1 into num from public.chillbros_invoices;
  new_number := 'E-' || lpad(num::text,greatest(3,length(num::text)),'0');
  update public.chillbros_invoices set invoice_number=new_number,issued_at=null where id=q.id;
  insert into public.chillbros_workflow_events(job_id,invoice_id,actor_id,stage,message)
    values(q.job_id,q.id,p_actor_id,'owner_document_type_override','Billing Override: Quote ' || q.invoice_number || ' changed to Estimate ' || new_number || '. All data and approval retained. Previous issue date (legacy quote stamp): ' || coalesce(q.issued_at::text,'none'));
  return q.id;
end $$;
revoke all on function public.chillbros_owner_quote_to_estimate(uuid,uuid) from public,anon,authenticated;
grant execute on function public.chillbros_owner_quote_to_estimate(uuid,uuid) to service_role;
notify pgrst, 'reload schema';
