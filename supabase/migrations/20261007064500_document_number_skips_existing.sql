-- Applied to the live Supabase project on 2026-10-07.
-- Root cause of "new invoice keeps disappearing": chillbros_document_counters.invoice was 7 while I-008 and I-009
-- already existed (chillbros_owner_convert_quote creates I- numbers without using the counter), so every new
-- invoice drew I-008, hit chillbros_invoices_invoice_number_key and rolled back.
-- The counter was also corrected by hand to 9. This function now never hands out a number already in use.
create or replace function public.chillbros_next_document_number(p_kind text)
 returns text language plpgsql security definer set search_path to 'public'
as $fn$
declare v_next integer; v_prefix text; v_max integer;
begin
  if p_kind not in ('estimate','quote','invoice','agreement') then raise exception 'invalid document kind'; end if;
  v_prefix := case p_kind when 'estimate' then 'E' when 'quote' then 'Q' when 'invoice' then 'I' else 'A' end;
  select coalesce(max(substring(invoice_number from '^[A-Z]-([0-9]+)$')::int), 0) into v_max
  from public.chillbros_invoices where invoice_number ~ ('^' || v_prefix || '-[0-9]+$');
  insert into public.chillbros_document_counters(kind,last_value,updated_at)
  values (p_kind, greatest(1, v_max + 1), now())
  on conflict (kind) do update set last_value = greatest(public.chillbros_document_counters.last_value, v_max) + 1, updated_at = now()
  returning last_value into v_next;
  return v_prefix || '-' || lpad(v_next::text,3,'0');
end;
$fn$;
