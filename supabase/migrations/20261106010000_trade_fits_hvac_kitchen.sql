-- Lead business: two more buyer trades, HVAC & refrigeration and hot side (commercial kitchen
-- equipment). Keep the rules in sync with tradeFitsFor() in lib/chillbros/trade-fit.ts.
--  - Openings and kitchens (cooking lines) fit all 10 trades.
--  - Every other commercial site fits everything except hood cleaning and kitchen equipment.
--  - Auto openings (industry = 'auto') are set explicitly at insert: no hood cleaning, no kitchen equipment.
create or replace function public.chillbros_revenue_trade_fits(p_category text, p_service_line text)
returns text[] language sql immutable as $$
  select case
    when p_category = 'opening_remodel' or p_service_line in ('multiple', 'kitchen_equipment', 'exhaust_hood')
      then array['plumbing','electrical','hood_cleaning','pest_control','commercial_cleaning','signs','low_voltage','security','hvac_refrigeration','kitchen_equipment']
    else array['plumbing','electrical','pest_control','commercial_cleaning','signs','low_voltage','security','hvac_refrigeration']
  end
$$;

update public.chillbros_revenue_prospects
   set trade_fits = public.chillbros_revenue_trade_fits(category, service_line)
 where industry is distinct from 'auto';
update public.chillbros_revenue_prospects
   set trade_fits = array['plumbing','electrical','pest_control','commercial_cleaning','signs','low_voltage','security','hvac_refrigeration']
 where industry = 'auto';

alter table public.chillbros_leadbiz_buyers drop constraint if exists chillbros_leadbiz_buyers_trade_check;
alter table public.chillbros_leadbiz_buyers add constraint chillbros_leadbiz_buyers_trade_check
  check (trade in ('plumbing','electrical','hood_cleaning','pest_control','commercial_cleaning','signs','low_voltage','security','hvac_refrigeration','kitchen_equipment'));
