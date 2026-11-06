-- Lead packs v2: fixed-count packs, monthly plans, and one ledger of exactly which project
-- went to which buyer. Rules enforced here (not just in copy):
--   * at most 3 buyers per trade per project (refunded/revoked orders free their slot)
--   * the same buyer email never gets the same project twice
--   * hood cleaners and kitchen equipment never get auto projects
-- Project rows (contacts from public TDLR filings) are loaded out of band, not committed to git.

create table if not exists public.chillbros_leadpack_products (
  key text primary key,
  name text not null,
  kind text not null check (kind in ('pack', 'subscription', 'legacy')),
  price_cents integer not null check (price_cents >= 0),
  projects integer not null check (projects between 0 and 500),
  contacts integer not null default 0 check (contacts between 0 and 500),
  industry text check (industry in ('food', 'auto')),          -- null = both
  exclusive boolean not null default false,
  on_sale boolean not null default true,
  square_link text,                                              -- null until the owner creates it in Square
  sort integer not null default 0
);

create table if not exists public.chillbros_leadpack_projects (
  key text primary key,                                          -- TDLR TABS record, e.g. TABS2026022608
  industry text not null check (industry in ('food', 'auto')),
  title text not null,
  data jsonb not null,                                           -- address, contact, role, phone, project, timing, source_url, openers{trade}
  active boolean not null default true,
  added_at timestamptz not null default now()
);

create table if not exists public.chillbros_leadpack_contacts (
  trade text not null,
  position integer not null,
  data jsonb not null,                                           -- name, address, phone, type, area, opener
  primary key (trade, position)
);

create table if not exists public.chillbros_leadpack_orders (
  id uuid primary key default gen_random_uuid(),
  square_ref text not null unique,                               -- Square order/payment id (+ '-YYYY-MM' for each monthly plan delivery)
  product text not null references public.chillbros_leadpack_products(key),
  trade text,
  buyer_email text not null,
  buyer_name text,
  amount_cents integer,
  status text not null check (status in ('delivered', 'trade_question', 'refund_needed', 'revoked')),
  note text,
  projects_owed integer not null default 0,
  projects_delivered integer not null default 0,
  token text unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  first_opened_at timestamptz,
  open_count integer not null default 0
);
create index if not exists chillbros_leadpack_orders_email on public.chillbros_leadpack_orders (lower(buyer_email));

create table if not exists public.chillbros_leadpack_deliveries (
  order_id uuid not null references public.chillbros_leadpack_orders(id),
  project_key text not null references public.chillbros_leadpack_projects(key),
  trade text not null,
  delivered_at timestamptz not null default now(),
  primary key (order_id, project_key)
);
create index if not exists chillbros_leadpack_deliveries_trade on public.chillbros_leadpack_deliveries (trade, project_key);

do $$ declare t text; begin
  foreach t in array array['products','projects','contacts','orders','deliveries'] loop
    execute format('alter table public.chillbros_leadpack_%I enable row level security', t);
    execute format('revoke all on public.chillbros_leadpack_%I from public, anon, authenticated', t);
    execute format('grant select, insert, update on public.chillbros_leadpack_%I to service_role', t);
  end loop;
end $$;

insert into public.chillbros_leadpack_products (key, name, kind, price_cents, projects, contacts, industry, exclusive, on_sale, sort) values
  ('starter',   'Starter Pack',        'pack',         8900,  5,  0, null, false, true, 1),
  ('trade',     'Trade Pack',          'pack',        14900,  9,  0, null, false, true, 2),
  ('growth',    'Growth Pack',         'pack',        19900, 13,  0, null, false, true, 3),
  ('pro',       'Pro Bundle',          'pack',        24900, 16, 50, null, false, true, 4),
  ('local',     'Local Plan',          'subscription', 9900,  6,  0, null, false, true, 5),
  ('pro_plan',  'Pro Plan',            'subscription',17900, 12,  0, null, false, true, 6),
  -- Old Square links (still honored if someone pays one before it is turned off in Square).
  ('legacy_starter',   'Commercial Starter Pack',        'legacy',  7500,   0, 50, null,   false, false, 90),
  ('legacy_auto',      'Auto Openings Pack',             'legacy',  9900, 500,  0, 'auto', false, false, 91),
  ('legacy_food',      'Restaurant & Retail Openings Pack','legacy',9900, 500,  0, 'food', false, false, 92),
  ('legacy_openings',  'New Openings Pack (Founding)',   'legacy', 15000, 500,  0, null,   false, false, 93),
  ('legacy_bundle',    'Founding Bundle',                'legacy', 19900, 500, 50, null,   false, false, 94),
  ('legacy_exclusive', 'Exclusive Trade Bundle',         'legacy', 44900, 500, 50, null,   true,  false, 95)
on conflict (key) do nothing;

-- Trades that never get auto projects (no kitchen to work on).
create or replace function public.chillbros_leadpack_food_only(p_trade text)
returns boolean language sql immutable set search_path = '' as $$
  select p_trade in ('hood-cleaners', 'kitchen-equipment')
$$;

-- Projects this trade can still be sold (fewer than 3 live buyers in the trade), optionally
-- excluding ones this email already has, filtered to the product's industry.
create or replace function public.chillbros_leadpack_open_projects(p_trade text, p_email text, p_industry text)
returns table (key text, buyers integer, added_at timestamptz)
language sql stable set search_path = '' as $$
  select p.key, coalesce(u.buyers, 0)::integer, p.added_at
  from public.chillbros_leadpack_projects p
  left join (
    select d.project_key, count(distinct lower(o.buyer_email)) as buyers
    from public.chillbros_leadpack_deliveries d
    join public.chillbros_leadpack_orders o on o.id = d.order_id and o.status = 'delivered'
    where d.trade = p_trade
    group by d.project_key
  ) u on u.project_key = p.key
  where p.active
    and coalesce(u.buyers, 0) < 3
    and (p_industry is null or p.industry = p_industry)
    and (not public.chillbros_leadpack_food_only(p_trade) or p.industry = 'food')
    and (p_email is null or not exists (
      select 1 from public.chillbros_leadpack_deliveries d2
      join public.chillbros_leadpack_orders o2 on o2.id = d2.order_id and o2.status = 'delivered'
      where d2.project_key = p.key and lower(o2.buyer_email) = lower(p_email)))
$$;

-- Checkout gate: how many projects a new buyer in this trade could get for this product.
create or replace function public.chillbros_leadpack_capacity(p_trade text, p_product text)
returns integer language sql stable set search_path = '' as $$
  select count(*)::integer from public.chillbros_leadpack_open_projects(
    p_trade, null, (select industry from public.chillbros_leadpack_products where key = p_product))
$$;

-- Record a paid Square sale and allocate its projects in one step. Idempotent on square_ref.
create or replace function public.chillbros_leadpack_record_order(
  p_square_ref text, p_product text, p_trade text, p_email text, p_name text, p_amount_cents integer)
returns jsonb language plpgsql set search_path = '' as $$
declare
  prod public.chillbros_leadpack_products;
  o public.chillbros_leadpack_orders;
  trades constant text[] := array['plumbers','electricians','hood-cleaners','pest-control','commercial-cleaning','signs','low-voltage','security','hvac-refrigeration','kitchen-equipment'];
  v_status text := 'delivered'; v_note text; got integer := 0;
begin
  if coalesce(trim(p_square_ref), '') = '' or coalesce(trim(p_email), '') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'square_ref and a valid buyer email are required';
  end if;
  select * into o from public.chillbros_leadpack_orders where square_ref = p_square_ref;
  if found then
    return jsonb_build_object('order_id', o.id, 'status', o.status, 'token', o.token, 'note', o.note,
      'projects_owed', o.projects_owed, 'projects_delivered', o.projects_delivered, 'duplicate', true);
  end if;
  select * into prod from public.chillbros_leadpack_products where key = p_product;
  if not found then raise exception 'unknown product %', p_product; end if;

  if p_trade is null or not (p_trade = any(trades)) then
    v_status := 'trade_question'; v_note := 'Trade missing or not one of the 10 trades; ask the buyer.';
  elsif prod.exclusive then
    v_status := 'refund_needed'; v_note := 'Exclusive Trade Bundle is retired; refund.';
  elsif prod.industry = 'auto' and public.chillbros_leadpack_food_only(p_trade) then
    v_status := 'refund_needed'; v_note := 'Auto pack does not fit this trade; refund or swap.';
  end if;

  -- One allocation at a time per trade so two buyers can't take the same last slot.
  perform pg_advisory_xact_lock(hashtextextended('leadpack:' || coalesce(p_trade, '-'), 0));

  insert into public.chillbros_leadpack_orders (square_ref, product, trade, buyer_email, buyer_name, amount_cents, status, note, projects_owed, token)
  values (p_square_ref, p_product, p_trade, lower(trim(p_email)), nullif(trim(p_name), ''), p_amount_cents, v_status, v_note,
          case when prod.kind = 'legacy' then 0 else prod.projects end,
          case when v_status = 'delivered' then replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') end)
  returning * into o;

  if v_status = 'delivered' and prod.projects > 0 then
    insert into public.chillbros_leadpack_deliveries (order_id, project_key, trade)
    select o.id, op.key, p_trade
    from public.chillbros_leadpack_open_projects(p_trade, p_email, prod.industry) op
    order by op.buyers asc, op.added_at desc, op.key
    limit prod.projects;
    get diagnostics got = row_count;
    update public.chillbros_leadpack_orders
      set projects_delivered = got,
          projects_owed = case when prod.kind = 'legacy' then got else prod.projects end,
          note = case when prod.kind <> 'legacy' and got < prod.projects
                      then format('Short %s project(s): only %s open for this trade. Credit or refund the difference.', prod.projects - got, got) end
      where id = o.id returning * into o;
  end if;

  return jsonb_build_object('order_id', o.id, 'status', o.status, 'token', o.token, 'note', o.note,
    'projects_owed', o.projects_owed, 'projects_delivered', o.projects_delivered, 'contacts', prod.contacts, 'duplicate', false);
end $$;

-- Trade answered later: re-run allocation for a trade_question order.
create or replace function public.chillbros_leadpack_set_trade(p_order uuid, p_trade text)
returns jsonb language plpgsql set search_path = '' as $$
declare o public.chillbros_leadpack_orders;
begin
  select * into o from public.chillbros_leadpack_orders where id = p_order for update;
  if not found or o.status <> 'trade_question' then raise exception 'order is not waiting on a trade'; end if;
  -- Keep the original row for the record (renamed + closed), then record the sale again with its trade.
  update public.chillbros_leadpack_orders
    set square_ref = o.square_ref || '~asked-trade', status = 'revoked', revoked_at = now(),
        note = concat_ws(' · ', note, 'Trade answered: ' || p_trade)
    where id = p_order;
  return public.chillbros_leadpack_record_order(o.square_ref, o.product, p_trade, o.buyer_email, o.buyer_name, o.amount_cents);
end $$;

-- Refund/abuse: link stops working and the order's slots open up again.
create or replace function public.chillbros_leadpack_revoke(p_order uuid, p_reason text)
returns void language sql set search_path = '' as $$
  update public.chillbros_leadpack_orders
    set status = 'revoked', revoked_at = now(), note = concat_ws(' · ', note, nullif(trim(p_reason), ''))
    where id = p_order and status <> 'revoked'
$$;

-- Owner view: per trade, how many projects are still open and how many buyers so far.
create or replace function public.chillbros_leadpack_trade_usage()
returns table (trade text, projects_total integer, projects_open integer, projects_full integer, buyers integer)
language sql stable set search_path = '' as $$
  select t.trade,
    (select count(*) from public.chillbros_leadpack_projects p where p.active and (not public.chillbros_leadpack_food_only(t.trade) or p.industry = 'food'))::integer,
    (select count(*) from public.chillbros_leadpack_open_projects(t.trade, null, null))::integer,
    (select count(*) from public.chillbros_leadpack_projects p where p.active and (not public.chillbros_leadpack_food_only(t.trade) or p.industry = 'food'))::integer
      - (select count(*) from public.chillbros_leadpack_open_projects(t.trade, null, null))::integer,
    (select count(distinct lower(o.buyer_email)) from public.chillbros_leadpack_orders o where o.trade = t.trade and o.status = 'delivered')::integer
  from unnest(array['plumbers','electricians','hood-cleaners','pest-control','commercial-cleaning','signs','low-voltage','security','hvac-refrigeration','kitchen-equipment']) as t(trade)
$$;

do $$ declare f text; begin
  foreach f in array array[
    'chillbros_leadpack_food_only(text)', 'chillbros_leadpack_open_projects(text,text,text)', 'chillbros_leadpack_capacity(text,text)',
    'chillbros_leadpack_record_order(text,text,text,text,text,integer)', 'chillbros_leadpack_set_trade(uuid,text)',
    'chillbros_leadpack_revoke(uuid,text)', 'chillbros_leadpack_trade_usage()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
