-- Buyer commerce is isolated from staff accounts, invoices and invoice card payments.
create table public.chillbros_market_settings (
  id integer primary key check(id=1), sales_enabled boolean not null default false,
  outreach_enabled boolean not null default false, tax_reviewed boolean not null default false, terms_reviewed boolean not null default false,
  brand_name text not null default 'Lead marketplace', seller_name text not null default '', seller_address text not null default '',
  tax_rate_bps integer not null default 0 check(tax_rate_bps between 0 and 2000),
  terms_version text not null default '2026-11-v1', support_email text not null default 'chillprostx@gmail.com'
);
insert into public.chillbros_market_settings(id) values(1);
create table public.chillbros_market_identities(id uuid primary key default gen_random_uuid(),email text not null unique,created_at timestamptz not null default now());
create table public.chillbros_market_login_codes(id uuid primary key default gen_random_uuid(),email text not null,code_hash text not null,attempts integer not null default 0,used_at timestamptz,expires_at timestamptz not null default now()+interval '10 minutes',created_at timestamptz not null default now());
create index chillbros_market_login_rate on public.chillbros_market_login_codes(email,created_at desc);
create table public.chillbros_market_sessions(token_hash text primary key,identity_id uuid not null references public.chillbros_market_identities(id),expires_at timestamptz not null,revoked_at timestamptz);
create table public.chillbros_market_buyers (
  id uuid primary key default gen_random_uuid(), account_id uuid not null unique references public.chillbros_market_identities(id),
  sender_key text not null unique references public.chillbros_outreach_senders(sender_key),
  email text not null, company_name text not null, postal_address text not null,
  status text not null default 'pending' check(status in ('pending','active','suspended')),
  automation_enabled boolean not null default false, daily_cap integer not null default 10 check(daily_cap between 1 and 50),
  terms_version text not null, terms_accepted_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.chillbros_market_listings (
  id uuid primary key default gen_random_uuid(), prospect_id uuid not null unique references public.chillbros_revenue_prospects(id),
  title text not null check(length(title) between 5 and 160), public_summary text not null check(length(public_summary) between 20 and 1200),
  city text not null, service_line text not null, tier text not null check(tier in ('researched_prospect','confirmed_need')),
  sale_type text not null check(sale_type in ('shared','exclusive')), max_buyers integer not null check(max_buyers between 1 and 5),
  price_cents integer not null default 0 check(price_cents between 0 and 500000),
  status text not null default 'draft' check(status in ('draft','published','paused')),
  created_by uuid not null references public.chillbros_profiles(id), created_at timestamptz not null default now(),
  check(sale_type<>'exclusive' or max_buyers=1), check(status<>'published' or price_cents>=100)
);
create table public.chillbros_market_requests (
  id uuid primary key default gen_random_uuid(), buyer_id uuid not null references public.chillbros_market_buyers(id),
  listing_id uuid not null references public.chillbros_market_listings(id), created_at timestamptz not null default now(), unique(buyer_id,listing_id)
);
create table public.chillbros_market_orders (
  id uuid primary key default gen_random_uuid(), buyer_id uuid not null references public.chillbros_market_buyers(id),
  listing_id uuid not null references public.chillbros_market_listings(id),
  status text not null default 'pending_payment' check(status in ('pending_payment','delivered','cancelled','refund_required','refund_pending','refunded')),
  price_cents integer not null, tax_cents integer not null, total_cents integer not null,
  terms_version text not null, terms_accepted_at timestamptz not null default now(),
  square_order_id text unique, square_link_id text, checkout_url text, square_payment_id text unique, square_refund_id text,
  checkout_state text not null default 'new' check(checkout_state in ('new','creating','ready','review')), checked_at timestamptz, mail_checked_at timestamptz,
  qualification_review_id uuid references public.chillbros_outreach_reviews(id),
  lead_snapshot jsonb, delivered_at timestamptz, created_at timestamptz not null default now(),
  unique(buyer_id,listing_id), check(total_cents=price_cents+tax_cents and total_cents>=100)
);
create index chillbros_market_orders_reconcile on public.chillbros_market_orders(status,created_at);
create table public.chillbros_market_claims (
  id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.chillbros_market_orders(id),
  buyer_id uuid not null references public.chillbros_market_buyers(id), reason text not null check(length(reason) between 20 and 3000),
  status text not null default 'open' check(status in ('open','approved','declined','resolved')),
  resolution text, created_at timestamptz not null default now()
);
create table public.chillbros_market_outcomes (
  order_id uuid primary key references public.chillbros_market_orders(id), buyer_id uuid not null references public.chillbros_market_buyers(id),
  stage text not null check(stage in ('new','contacted','responded','appointment','won','lost','do_not_contact')),
  revenue_cents integer not null default 0 check(revenue_cents>=0), notes text not null default '', updated_at timestamptz not null default now()
);
create table public.chillbros_market_mailboxes (
  buyer_id uuid primary key references public.chillbros_market_buyers(id), provider text not null check(provider in ('smtp','google','microsoft')),
  email text not null, encrypted_credentials text not null, verified_at timestamptz not null,
  status text not null default 'connected' check(status in ('connected','disconnected','error')), updated_at timestamptz not null default now()
);
create table public.chillbros_market_suppressions (
  buyer_id uuid not null references public.chillbros_market_buyers(id), contact text not null,
  reason text not null default 'unsubscribed', created_at timestamptz not null default now(), primary key(buyer_id,contact)
);
create table public.chillbros_market_mail_log (
  id uuid primary key default gen_random_uuid(), buyer_id uuid not null references public.chillbros_market_buyers(id),
  order_id uuid not null unique references public.chillbros_market_orders(id), recipient text not null,
  status text not null default 'reserved' check(status in ('reserved','accepted','failed','uncertain')),
  qualification_review_id uuid not null references public.chillbros_outreach_reviews(id),
  provider_message_id text, error text, created_at timestamptz not null default now(), unique(buyer_id,recipient)
);
create table public.chillbros_market_events (
  id uuid primary key default gen_random_uuid(), buyer_id uuid references public.chillbros_market_buyers(id),
  order_id uuid references public.chillbros_market_orders(id), event text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['settings','identities','login_codes','sessions','buyers','listings','requests','orders','claims','outcomes','mailboxes','suppressions','mail_log','events'] loop
    execute format('alter table public.chillbros_market_%I enable row level security',t);
    execute format('revoke all on public.chillbros_market_%I from public,anon,authenticated,service_role',t);
    execute format('grant select,insert,update on public.chillbros_market_%I to service_role',t);
  end loop;
end $$;
revoke update on public.chillbros_market_events from service_role;

create function public.chillbros_market_register(account_input uuid,email_input text,company_input text,address_input text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare buyer uuid:=gen_random_uuid(); sender text;
begin
  if not exists(select 1 from public.chillbros_market_identities where id=account_input and lower(email)=lower(email_input))
    or length(trim(company_input))<2 or length(trim(address_input))<10 then raise exception 'Verified email, company and postal address required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(account_input::text,0));
  select id into buyer from public.chillbros_market_buyers where account_id=account_input;
  if found then return buyer; end if;
  buyer:=gen_random_uuid(); sender:='buyer-'||replace(buyer::text,'-','');
  insert into public.chillbros_outreach_senders(sender_key,display_name,kind,approval_hold,transport_ready) values(sender,company_input,'buyer',true,false);
  insert into public.chillbros_market_buyers(id,account_id,sender_key,email,company_name,postal_address,terms_version)
    values(buyer,account_input,sender,lower(email_input),company_input,address_input,(select terms_version from public.chillbros_market_settings where id=1));
  return buyer;
end $$;

-- Commerce rights are independent of whether an outbound mailbox is connected.
create function public.chillbros_market_qualification(prospect_input uuid,buyer_input uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare p public.chillbros_revenue_prospects; b public.chillbros_market_buyers; r public.chillbros_outreach_reviews;
  reasons text[]:='{}';
begin
  select * into p from public.chillbros_revenue_prospects where id=prospect_input;
  if not found then return jsonb_build_object('eligible',false,'reasons',jsonb_build_array('Lead unavailable')); end if;
  select * into b from public.chillbros_market_buyers where id=buyer_input;
  if not found or b.status<>'active' then reasons:=array_append(reasons,'Buyer business approval required'); end if;
  if p.do_not_contact or p.status::text in ('skipped','won','lost') or coalesce(p.sales_status::text,'new') in ('won','lost','do_not_contact') then reasons:=array_append(reasons,'Lead is restricted'); end if;
  if nullif(trim(p.business_address),'') is null or coalesce(p.contact_email,'') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then reasons:=array_append(reasons,'Verified location and usable email required'); end if;
  if exists(select 1 from public.chillbros_outreach_suppressions where lower(trim(contact))=lower(trim(p.contact_email)))
    or exists(select 1 from public.chillbros_market_suppressions where buyer_id=buyer_input and contact=lower(trim(p.contact_email)))
    or exists(select 1 from public.chillbros_revenue_contacts c where c.do_not_contact and lower(trim(c.email))=lower(trim(p.contact_email))) then reasons:=array_append(reasons,'Contact is suppressed'); end if;
  if exists(select 1 from public.chillbros_customers c where lower(trim(c.name))=lower(trim(p.business_name))
    or lower(trim(p.contact_email))=any(regexp_split_to_array(lower(coalesce(c.email,'')), '[,;\s]+'))) then reasons:=array_append(reasons,'Existing customer excluded'); end if;
  if exists(select 1 from public.chillbros_revenue_prospects d where d.id<>p.id and
    (lower(rtrim(d.source_url,'/'))=lower(rtrim(p.source_url,'/')) or
    (regexp_replace(lower(d.business_name),'[^a-z0-9]','','g')=regexp_replace(lower(p.business_name),'[^a-z0-9]','','g') and
     regexp_replace(lower(d.business_address),'[^a-z0-9]','','g')=regexp_replace(lower(p.business_address),'[^a-z0-9]','','g')))) then reasons:=array_append(reasons,'Duplicate location requires review'); end if;
  if p.source_url ~* '^https?://([^/]*\.)?(google\.[^/]+|googleapis\.com|maps\.app\.goo\.gl)/' then reasons:=array_append(reasons,'Source use not approved'); end if;
  select * into r from public.chillbros_outreach_reviews where prospect_id=p.id and sender_key=b.sender_key order by created_at desc,id desc limit 1;
  if not found or r.verdict<>'approved' then reasons:=array_append(reasons,'Sender-specific resale review required');
  else
    if not r.resale_permitted or not r.sharing_permitted or not r.outreach_permitted then reasons:=array_append(reasons,'Resale, sharing and outreach permissions required'); end if;
    if r.snapshot is distinct from public.chillbros_outreach_snapshot(p) then reasons:=array_append(reasons,'Lead changed since review'); end if;
    if r.contact_checked_at<now()-interval '30 days' or r.source_checked_at<now()-interval '30 days'
      or (r.tier='confirmed_need' and r.need_confirmed_at<now()-interval '7 days') then reasons:=array_append(reasons,'Evidence expired'); end if;
    if not exists(select 1 from public.chillbros_profiles where id=r.reviewed_by and role::text='manager' and status::text='active') then reasons:=array_append(reasons,'Reviewer no longer active'); end if;
  end if;
  return jsonb_build_object('eligible',cardinality(reasons)=0,'reasons',to_jsonb(reasons),'review_id',r.id,'tier',r.tier);
end $$;

create function public.chillbros_market_reserve_order(buyer_input uuid,listing_input uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare l public.chillbros_market_listings; s public.chillbros_market_settings; prior uuid; used integer; tax integer; decision jsonb;
begin
  select * into s from public.chillbros_market_settings where id=1;
  if not s.sales_enabled or not s.tax_reviewed or not s.terms_reviewed or length(trim(s.seller_name))<2 or length(trim(s.seller_address))<10 then raise exception 'Sales are not open yet'; end if;
  perform 1 from public.chillbros_market_buyers where id=buyer_input for update;
  select * into l from public.chillbros_market_listings where id=listing_input for update;
  if not found or l.status<>'published' or l.price_cents<100 then raise exception 'Offer unavailable'; end if;
  select id into prior from public.chillbros_market_orders where buyer_id=buyer_input and listing_id=listing_input;
  if found then return prior; end if;
  if (select count(*) from public.chillbros_market_orders where buyer_id=buyer_input and status='pending_payment')>=3 then raise exception 'Complete or cancel an open checkout first'; end if;
  decision:=public.chillbros_market_qualification(l.prospect_id,buyer_input);
  if not coalesce((decision->>'eligible')::boolean,false) or decision->>'tier'<>l.tier then raise exception 'This offer needs a fresh buyer-specific evidence review'; end if;
  select count(*) into used from public.chillbros_market_orders where listing_id=l.id
    and (status in ('pending_payment','delivered','refund_required','refund_pending') or delivered_at is not null);
  if used>=l.max_buyers then raise exception 'This offer is sold out or reserved'; end if;
  tax:=round(l.price_cents*s.tax_rate_bps/10000.0)::integer;
  insert into public.chillbros_market_orders(buyer_id,listing_id,price_cents,tax_cents,total_cents,terms_version,qualification_review_id)
  values(buyer_input,l.id,l.price_cents,tax,l.price_cents+tax,s.terms_version,(decision->>'review_id')::uuid) returning id into prior;
  return prior;
end $$;

create function public.chillbros_market_settle(order_input uuid,payment_input text,amount_input integer)
returns text language plpgsql security invoker set search_path='' as $$
declare o public.chillbros_market_orders; l public.chillbros_market_listings; p public.chillbros_revenue_prospects; decision jsonb;
begin
  select * into o from public.chillbros_market_orders where id=order_input for update;
  if not found then raise exception 'Order not found'; end if;
  if o.square_payment_id is not null then
    if o.square_payment_id<>payment_input then raise exception 'Unexpected second payment'; end if;
    return o.status;
  end if;
  if amount_input<>o.total_cents or length(payment_input)<4 then raise exception 'Payment mismatch'; end if;
  select * into l from public.chillbros_market_listings where id=o.listing_id for update;
  select * into p from public.chillbros_revenue_prospects where id=l.prospect_id for update;
  decision:=public.chillbros_market_qualification(l.prospect_id,o.buyer_id);
  if o.status<>'pending_payment' or not coalesce((decision->>'eligible')::boolean,false) or decision->>'tier'<>l.tier then
    update public.chillbros_market_orders set square_payment_id=payment_input,status='refund_required' where id=o.id;
    return 'refund_required';
  end if;
  update public.chillbros_market_orders set status='delivered',square_payment_id=payment_input,delivered_at=now(),
    qualification_review_id=(decision->>'review_id')::uuid,
    lead_snapshot=jsonb_build_object('business_name',p.business_name,'city',p.city,'business_address',p.business_address,
      'contact_name',p.contact_name,'contact_role',p.contact_role,'contact_email',p.contact_email,'contact_phone',p.contact_phone,
      'service_line',p.service_line,'source_url',p.source_url,'signal_summary',p.signal_summary,'signal_observed_at',p.signal_observed_at,
      'tier',l.tier,'sale_type',l.sale_type,'max_buyers',l.max_buyers,'policy','v1') where id=o.id;
  insert into public.chillbros_market_events(buyer_id,order_id,event,details) values(o.buyer_id,o.id,'delivered',jsonb_build_object('review_id',decision->>'review_id','payment_id',payment_input));
  return 'delivered';
end $$;

create function public.chillbros_market_reserve_email(order_input uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare o public.chillbros_market_orders; b public.chillbros_market_buyers; l public.chillbros_market_listings; decision jsonb; recipient text; receipt uuid;
begin
  if not exists(select 1 from public.chillbros_market_settings where id=1 and outreach_enabled)
    or not exists(select 1 from public.chillbros_autopilot_settings where id=1 and enabled and not outreach_approval_hold) then return null; end if;
  select * into o from public.chillbros_market_orders where id=order_input;
  if not found or o.status<>'delivered' then return null; end if;
  select * into b from public.chillbros_market_buyers where id=o.buyer_id for update;
  if not b.automation_enabled or b.status<>'active' or length(trim(b.postal_address))<10 then return null; end if;
  if not exists(select 1 from public.chillbros_market_mailboxes where buyer_id=b.id and status='connected' and verified_at is not null) then return null; end if;
  if exists(select 1 from public.chillbros_market_outcomes where order_id=o.id and stage in ('responded','appointment','won','lost','do_not_contact')) then return null; end if;
  if (select count(*) from public.chillbros_market_mail_log where buyer_id=b.id and status in ('reserved','accepted','uncertain')
    and created_at>=(date_trunc('day',now() at time zone 'America/Chicago') at time zone 'America/Chicago'))>=b.daily_cap then return null; end if;
  select * into l from public.chillbros_market_listings where id=o.listing_id;
  decision:=public.chillbros_market_qualification(l.prospect_id,b.id);
  if not coalesce((decision->>'eligible')::boolean,false) then return null; end if;
  recipient:=lower(trim(o.lead_snapshot->>'contact_email'));
  if not exists(select 1 from public.chillbros_revenue_prospects where id=l.prospect_id and lower(trim(contact_email))=recipient) then return null; end if;
  insert into public.chillbros_market_mail_log(buyer_id,order_id,recipient,qualification_review_id)
    values(b.id,o.id,recipient,(decision->>'review_id')::uuid) on conflict do nothing returning id into receipt;
  return receipt;
end $$;

-- Existing sold inventory cannot be made exclusive or silently repriced.
create function public.chillbros_market_listing_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' and exists(select 1 from public.chillbros_market_orders where listing_id=old.id)
    and (new.prospect_id,new.sale_type,new.max_buyers,new.price_cents,new.tier) is distinct from (old.prospect_id,old.sale_type,old.max_buyers,old.price_cents,old.tier) then
    raise exception 'Offers with orders can only be paused; their license and price are fixed';
  end if;
  return new;
end $$;
create trigger chillbros_market_listing_terms before update on public.chillbros_market_listings for each row execute function public.chillbros_market_listing_guard();

revoke all on function public.chillbros_market_register(uuid,text,text,text),public.chillbros_market_qualification(uuid,uuid),public.chillbros_market_reserve_order(uuid,uuid),public.chillbros_market_settle(uuid,text,integer),public.chillbros_market_reserve_email(uuid),public.chillbros_market_listing_guard() from public,anon,authenticated;
grant execute on function public.chillbros_market_register(uuid,text,text,text),public.chillbros_market_qualification(uuid,uuid),public.chillbros_market_reserve_order(uuid,uuid),public.chillbros_market_settle(uuid,text,integer),public.chillbros_market_reserve_email(uuid),public.chillbros_market_listing_guard() to service_role;

create function public.chillbros_market_request_code(email_input text,hash_input text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(75331991);
  if (select count(*) from public.chillbros_market_login_codes where created_at>now()-interval '1 hour')>=150
    or (select count(*) from public.chillbros_market_login_codes where email=email_input and created_at>now()-interval '1 hour')>=5 then return false; end if;
  update public.chillbros_market_login_codes set used_at=now() where email=email_input and used_at is null;
  insert into public.chillbros_market_login_codes(email,code_hash) values(email_input,hash_input);
  return true;
end $$;
create function public.chillbros_market_verify_code(email_input text,hash_input text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.chillbros_market_login_codes; identity uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(email_input,7));
  select * into c from public.chillbros_market_login_codes where email=email_input and used_at is null order by created_at desc,id desc limit 1 for update;
  if not found or c.expires_at<now() or c.attempts>=5 then return null; end if;
  update public.chillbros_market_login_codes set attempts=attempts+1 where id=c.id;
  if c.code_hash<>hash_input then return null; end if;
  update public.chillbros_market_login_codes set used_at=now() where email=email_input and used_at is null;
  insert into public.chillbros_market_identities(email) values(email_input) on conflict(email) do update set email=excluded.email returning id into identity;
  return identity;
end $$;
revoke all on function public.chillbros_market_request_code(text,text),public.chillbros_market_verify_code(text,text) from public,anon,authenticated;
grant execute on function public.chillbros_market_request_code(text,text),public.chillbros_market_verify_code(text,text) to service_role;

create function public.chillbros_market_claim_checkout(order_input uuid,buyer_input uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare o public.chillbros_market_orders;
begin
  select * into o from public.chillbros_market_orders where id=order_input and buyer_id=buyer_input for update;
  if not found or o.status<>'pending_payment' then raise exception 'Unpaid order not found'; end if;
  if o.checkout_url is not null or o.checkout_state<>'new' then return false; end if;
  update public.chillbros_market_orders set checkout_state='creating' where id=o.id;
  return true;
end $$;
revoke all on function public.chillbros_market_claim_checkout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.chillbros_market_claim_checkout(uuid,uuid) to service_role;
