-- Run against the existing database. All synthetic data rolls back.
begin;
do $$
declare c uuid; j uuid; q uuid; n uuid; actor uuid; before_row jsonb; after_row jsonb; rejected boolean := false;
begin
  select id into actor from public.chillbros_profiles where role='manager' and status='active' limit 1;
  insert into public.chillbros_customers(name) values ('TEST owner conversion rollback') returning id into c;
  insert into public.chillbros_jobs(customer_id,scope,labor_hours,drive_hours) values(c,'Synthetic equipment repair',2,0.5) returning id into j;
  insert into public.chillbros_invoices(invoice_number,job_id,customer_id,status,signature_name,signed_at,notes,discount_type,discount_value,discount_amount,tax_rate,taxable_subtotal,tax_amount,payment_terms,down_payment_type,down_payment_value,down_payment_amount,down_payment_status)
    values('Q-TEST-' || gen_random_uuid(),j,c,'approved','Test approval',now(),'Customer and technician notes','dollar',15,15,8.25,180,13.6125,'net_7','dollar',20,20,'paid') returning id into q;
  insert into public.chillbros_invoice_line_items(invoice_id,label,description,quantity,unit_price,amount,taxable,sort_order)
    values(q,'Labor','Repair detail',2,80,160,true,0),(q,'Parts','Part detail',1,20,20,true,1),(q,'Fees','Trip',1,35,35,false,2);
  begin perform public.chillbros_owner_convert_quote(q,gen_random_uuid()); exception when others then rejected := true; end;
  assert rejected, 'Unauthorized actor accepted';
  assert not has_function_privilege('anon','public.chillbros_owner_convert_quote(uuid,uuid)','EXECUTE'), 'Anonymous RPC exposed';
  assert not has_function_privilege('authenticated','public.chillbros_owner_quote_to_estimate(uuid,uuid)','EXECUTE'), 'Authenticated RPC exposed';
  select to_jsonb(i) - 'invoice_number' - 'updated_at' into before_row from public.chillbros_invoices i where id=q;
  perform public.chillbros_owner_quote_to_estimate(q,actor);
  perform public.chillbros_owner_quote_to_estimate(q,actor);
  select to_jsonb(i) - 'invoice_number' - 'updated_at' into after_row from public.chillbros_invoices i where id=q;
  assert before_row=after_row, 'Estimate override lost document data';
  assert (select count(*)=1 from public.chillbros_workflow_events where invoice_id=q and stage='owner_document_type_override'), 'Override audit missing or duplicated';
  n := public.chillbros_owner_convert_quote(q,actor);
  assert n=public.chillbros_owner_convert_quote(q,actor), 'Repeat conversion created another invoice';
  assert (select count(*)=1 from public.chillbros_invoices where source_quote_id=q), 'Duplicate invoice';
  assert (select status='approved' and payment_status='unpaid' and issued_at is not null and invoice_number like 'I-%' from public.chillbros_invoices where id=n), 'Invoice not Waiting for Payment';
  assert (select issued_at is null and status='approved' and converted_invoice_id=n from public.chillbros_invoices where id=q), 'Original quote destroyed';
  assert (select to_jsonb(i)-array['id','invoice_id'] from public.chillbros_invoice_line_items i where invoice_id=q and sort_order=0)=(select to_jsonb(i)-array['id','invoice_id'] from public.chillbros_invoice_line_items i where invoice_id=n and sort_order=0), 'Line data differs';
  assert (select count(*)=3 from public.chillbros_invoice_line_items where invoice_id=n), 'Line count differs';
  assert (select customer_id=c and job_id=j and notes='Customer and technician notes' and signature_name='Test approval' and discount_amount=15 and tax_rate=8.25 and tax_amount=13.61 and payment_terms='net_7' and down_payment_status='paid' and down_payment_amount=20 from public.chillbros_invoices where id=n), 'Copied billing or approval data differs';
  assert (select count(*)=1 from public.chillbros_workflow_events where invoice_id=n and stage='quote_converted_to_invoice'), 'Conversion audit missing or duplicated';
  update public.chillbros_invoices set status='draft',converted_invoice_id=null,job_id=null where id=q;
  rejected := false;
  begin perform public.chillbros_owner_convert_quote(q,actor); exception when others then rejected := true; end;
  assert rejected, 'Unapproved quote accepted';
end $$;
rollback;
select 'PASS: authorization, override preservation/audit, approval guard, copied line/billing/approval data, unpaid issued status, original retention, idempotency' as result;
