-- Lead business: tag every Revenue Radar lead with the buyer trades it fits.
-- Keep the rules in sync with tradeFitsFor() in lib/chillbros/trade-fit.ts.
alter table public.chillbros_revenue_prospects
  add column if not exists trade_fits text[] not null default '{}';

create or replace function public.chillbros_revenue_trade_fits(p_category text, p_service_line text)
returns text[] language sql immutable as $$
  select case
    when p_category = 'opening_remodel' or p_service_line in ('multiple', 'kitchen_equipment', 'exhaust_hood')
      then array['plumbing','electrical','hood_cleaning','pest_control','commercial_cleaning','signs','low_voltage','security']
    else array['plumbing','electrical','pest_control','commercial_cleaning','signs','low_voltage','security']
  end
$$;

create or replace function public.chillbros_revenue_set_trade_fits()
returns trigger language plpgsql as $$
begin
  -- Recompute on insert, and when the lead type changes, unless a caller set fits explicitly.
  if tg_op = 'INSERT' and coalesce(array_length(new.trade_fits, 1), 0) = 0
     or tg_op = 'UPDATE' and (new.category is distinct from old.category or new.service_line is distinct from old.service_line)
        and new.trade_fits is not distinct from old.trade_fits then
    new.trade_fits := public.chillbros_revenue_trade_fits(new.category, new.service_line);
  end if;
  return new;
end
$$;

drop trigger if exists chillbros_revenue_trade_fits on public.chillbros_revenue_prospects;
create trigger chillbros_revenue_trade_fits
  before insert or update on public.chillbros_revenue_prospects
  for each row execute function public.chillbros_revenue_set_trade_fits();

update public.chillbros_revenue_prospects
  set trade_fits = public.chillbros_revenue_trade_fits(category, service_line)
  where coalesce(array_length(trade_fits, 1), 0) = 0;

create index if not exists chillbros_revenue_prospects_trade_fits_idx
  on public.chillbros_revenue_prospects using gin (trade_fits);
