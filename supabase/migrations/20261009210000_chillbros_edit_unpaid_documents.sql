-- Owner/office can edit ANY unpaid quote or invoice in place (lines, notes,
-- down payment) without reopening it, so a ready-to-pay invoice stays
-- ready-to-pay. Paid invoices stay locked (use credits/refunds).
--
-- Also fixes two payment-path problems found in the 2026-10-09 audit:
--  1. chillbros_invoices_paid_has_timestamp required paid_recorded_by on every
--     paid invoice, so an automatic Square card payment (no staff member)
--     could never be marked paid — the webhook update was rejected.
--  2. Line items were capped at 20 rows; raised to 40 so parts + equipment fit.

alter table public.chillbros_invoices
  drop constraint if exists chillbros_invoices_paid_has_timestamp;
alter table public.chillbros_invoices
  add constraint chillbros_invoices_paid_has_timestamp
  check (
    payment_status <> 'paid'::public.chillbros_payment_status
    or (paid_at is not null and (paid_recorded_by is not null or payment_method = 'card'::public.chillbros_payment_method))
  );

alter table public.chillbros_invoice_line_items
  drop constraint if exists chillbros_invoice_line_items_valid_sort_order;
alter table public.chillbros_invoice_line_items
  add constraint chillbros_invoice_line_items_valid_sort_order
  check (sort_order between 0 and 39);

-- Applied to production 2026-10-09 in this exact form (split into a calc
-- helper + writer so it could be pasted into the Supabase SQL editor).

create or replace function public.chillbros_revise_calc(p_id uuid,p_lines jsonb,p_dpt text,p_dpv numeric)
returns jsonb language plpgsql set search_path='' as $f$
declare inv public.chillbros_invoices%rowtype; it jsonb; i int; n int; q numeric; a numeric;
sub numeric:=0; txs numeric:=0; disc numeric:=0; tax numeric:=0; tot numeric:=0; old numeric:=0; cred numeric:=0;
dpt text; dpv numeric:=0; dpa numeric:=0; rate numeric;
begin
n:=jsonb_array_length(p_lines);
if n<1 or n>40 then raise exception 'Add 1 to 40 line items.'; end if;
select * into inv from public.chillbros_invoices where id=p_id for update;
if not found or inv.revoked_at is not null or inv.status='void' or inv.converted_invoice_id is not null then raise exception 'This document is not active.'; end if;
if inv.payment_status='paid' then raise exception 'Paid invoices are locked. Use a credit or refund.'; end if;
select coalesce(sum(amount),0) into old from public.chillbros_invoice_line_items where invoice_id=p_id;
old:=greatest(old-coalesce(inv.discount_amount,0),0)+coalesce(inv.tax_amount,0);
select coalesce(sum(amount),0) into cred from public.chillbros_invoice_adjustments where invoice_id=p_id and adjustment_type='credit';
select case when coalesce(tax_exempt,false) then 0 else coalesce(inv.tax_rate,0) end into rate from public.chillbros_customers where id=inv.customer_id;
for i in 0..n-1 loop it:=p_lines->i;
q:=coalesce(nullif(it->>'quantity','')::numeric,1); a:=round(q*coalesce(nullif(it->>'unit_price','')::numeric,0),2);
if q<=0 or q>1000 or a<0 or a>100000 or length(btrim(coalesce(it->>'label','')))=0 then raise exception 'Check line %.',i+1; end if;
sub:=sub+a; if coalesce((it->>'taxable')::boolean,false) then txs:=txs+a; end if;
end loop;
if sub<=0 or sub>250000 then raise exception 'Total must be $0.01 to $250,000.'; end if;
if inv.discount_type='percent' then disc:=round(sub*least(inv.discount_value,100)/100,2); elsif inv.discount_type='dollar' then disc:=least(inv.discount_value,sub); end if;
tax:=round(greatest(txs-round(disc*(txs/sub),2),0)*coalesce(rate,0)/100,2);
tot:=greatest(sub-disc,0)+tax;
if inv.down_payment_status='paid' then dpt:=inv.down_payment_type; dpv:=inv.down_payment_value; dpa:=inv.down_payment_amount;
 if greatest(tot-cred,0)<dpa then raise exception 'New total is below the down payment already received.'; end if;
else dpt:=nullif(p_dpt,''); dpv:=coalesce(p_dpv,0);
 if (dpt is not null and dpt not in ('percent','dollar')) or dpv<0 or (dpt='percent' and dpv>100) then raise exception 'Check the down payment.'; end if;
 if dpt is null then dpv:=0; elsif dpt='percent' then dpa:=round(tot*dpv/100,2); else dpa:=round(least(dpv,tot),2); end if;
end if;
return jsonb_build_object('status',inv.status,'dp_paid',inv.down_payment_status='paid','old',round(old,2),'tot',round(tot,2),'disc',disc,'txs',txs,'tax',tax,'rate',coalesce(rate,0),'dpt',dpt,'dpv',dpv,'dpa',dpa);
end $f$;
revoke all on function public.chillbros_revise_calc(uuid,jsonb,text,numeric) from public, anon, authenticated;

create or replace function public.chillbros_owner_revise_unpaid_document(p_invoice_id uuid,p_notes text,p_line_items jsonb,p_down_payment_type text,p_down_payment_value numeric)
returns jsonb language plpgsql set search_path='' as $f$
declare c jsonb; it jsonb; i int; q numeric; up numeric;
begin
if length(coalesce(p_notes,''))>2000 then raise exception 'Notes must be 2,000 characters or fewer.'; end if;
c:=public.chillbros_revise_calc(p_invoice_id,p_line_items,p_down_payment_type,p_down_payment_value);
delete from public.chillbros_invoice_line_items where invoice_id=p_invoice_id;
for i in 0..jsonb_array_length(p_line_items)-1 loop it:=p_line_items->i;
q:=coalesce(nullif(it->>'quantity','')::numeric,1); up:=coalesce(nullif(it->>'unit_price','')::numeric,0);
insert into public.chillbros_invoice_line_items(invoice_id,label,description,quantity,unit_price,amount,sort_order,taxable)
values(p_invoice_id,btrim(it->>'label'),nullif(btrim(coalesce(it->>'description','')),''),q,up,round(q*up,2),i,coalesce((it->>'taxable')::boolean,false));
end loop;
update public.chillbros_invoices set notes=nullif(btrim(coalesce(p_notes,'')),''),discount_amount=(c->>'disc')::numeric,taxable_subtotal=(c->>'txs')::numeric,
tax_rate=(c->>'rate')::numeric,tax_amount=(c->>'tax')::numeric,down_payment_type=c->>'dpt',down_payment_value=(c->>'dpv')::numeric,down_payment_amount=(c->>'dpa')::numeric,updated_at=now() where id=p_invoice_id;
if c->>'status'='approved' then delete from public.chillbros_document_archives where invoice_id=p_invoice_id and stage='approved'; end if;
return jsonb_build_object('status',c->>'status','old_total',(c->>'old')::numeric,'new_total',(c->>'tot')::numeric,'down_payment_amount',(c->>'dpa')::numeric,'down_payment_paid',(c->>'dp_paid')::boolean);
end $f$;
revoke all on function public.chillbros_owner_revise_unpaid_document(uuid,text,jsonb,text,numeric) from public, anon, authenticated;
grant execute on function public.chillbros_owner_revise_unpaid_document(uuid,text,jsonb,text,numeric) to service_role;
notify pgrst, 'reload schema';
