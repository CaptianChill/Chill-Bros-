-- Isolated test data only. Never invokes a payment or mail transport.
begin;
do $test$
declare p uuid:='00000000-0000-4000-8000-000000000002'; manager uuid:='00000000-0000-4000-8000-000000000001';
  identity1 uuid:='00000000-0000-4000-8000-000000000011'; identity2 uuid:='00000000-0000-4000-8000-000000000012';
  listing uuid:='00000000-0000-4000-8000-000000000013'; b1 uuid; b2 uuid; o uuid; prior uuid; receipt uuid; blocked boolean; s text; i integer;
begin
  if has_table_privilege('anon','public.chillbros_market_orders','SELECT') or has_table_privilege('authenticated','public.chillbros_market_mailboxes','SELECT') then raise exception 'Private data is exposed'; end if;
  if has_function_privilege('anon','public.chillbros_market_settle(uuid,text,integer)','EXECUTE') then raise exception 'Anonymous settlement exposed'; end if;
  if has_table_privilege('service_role','public.chillbros_market_events','UPDATE') then raise exception 'Audit events are mutable'; end if;
  if public.chillbros_market_request_code('auth-fixture@fixture-business.com','hash-one') is not true then raise exception 'Code request failed'; end if;
  for i in 1..5 loop
    if public.chillbros_market_verify_code('auth-fixture@fixture-business.com','wrong-hash') is not null then raise exception 'Wrong OTP accepted'; end if;
  end loop;
  if public.chillbros_market_verify_code('auth-fixture@fixture-business.com','hash-one') is not null then raise exception 'Attempt limit bypassed'; end if;
  perform public.chillbros_market_request_code('auth-fixture@fixture-business.com','hash-two');
  if public.chillbros_market_verify_code('auth-fixture@fixture-business.com','hash-two') is null then raise exception 'New code did not unlock'; end if;
  if public.chillbros_market_verify_code('auth-fixture@fixture-business.com','hash-two') is not null then raise exception 'Used code replayed'; end if;
  insert into public.chillbros_market_identities(id,email) values(identity1,'buyer-one@fixture-business.com'),(identity2,'buyer-two@fixture-business.com');
  b1:=public.chillbros_market_register(identity1,'buyer-one@fixture-business.com','Buyer One','100 Fixture Road, Test City');
  b2:=public.chillbros_market_register(identity2,'buyer-two@fixture-business.com','Buyer Two','200 Fixture Road, Test City');
  if b1= b2 or b1 is null then raise exception 'Buyer isolation failed'; end if;
  if public.chillbros_market_register(identity1,'buyer-one@fixture-business.com','Buyer One','100 Fixture Road, Test City')<>b1 then raise exception 'Registration is not idempotent'; end if;
  blocked:=false; begin
    perform public.chillbros_market_register(identity1,'buyer-two@fixture-business.com','Wrong Buyer','100 Fixture Road, Test City');
  exception when others then blocked:=true; end;
  if not blocked then raise exception 'Verified identity/email mismatch accepted'; end if;
  update public.chillbros_revenue_prospects set business_name='Fixture business',business_address='300 Fixture Avenue, Test City',
    contact_email='contact@fixture-business.com',source_url='https://fixture-business.com/source',signal_observed_at=now(),signal_summary='Research fixture, no buying intent',service_line='refrigeration',city='Test City' where id=p;
  update public.chillbros_market_buyers set status='active' where id in(b1,b2);
  insert into public.chillbros_outreach_reviews(prospect_id,sender_key,verdict,tier,contact_checked_at,source_checked_at,contact_evidence,source_rights_evidence,
    location_verified,role_verified,outreach_permitted,resale_permitted,sharing_permitted,reviewed_by,snapshot)
  select p,sender_key,'approved','researched_prospect',now(),now(),'Fixture direct contact review documented','Fixture resale and sharing license documented',true,true,true,true,true,manager,public.chillbros_outreach_review_snapshot(p)
    from public.chillbros_market_buyers where id in(b1,b2);
  if not (public.chillbros_market_qualification(p,b1)->>'eligible')::boolean then raise exception 'Fresh permission did not qualify'; end if;
  insert into public.chillbros_market_listings(id,prospect_id,title,public_summary,city,service_line,tier,sale_type,max_buyers,price_cents,status,created_by)
  values(listing,p,'Anonymous fixture prospect','Factual fixture summary without buying intent','Test City','refrigeration','researched_prospect','exclusive',1,1000,'published',manager);
  blocked:=false; begin perform public.chillbros_market_reserve_order(b1,listing); exception when others then blocked:=true; end;
  if not blocked then raise exception 'Closed sales accepted a reservation'; end if;
  update public.chillbros_market_settings set sales_enabled=true,tax_reviewed=true,terms_reviewed=true,seller_name='Fixture seller',seller_address='400 Fixture Road',tax_rate_bps=825 where id=1;
  o:=public.chillbros_market_reserve_order(b1,listing);
  if public.chillbros_market_reserve_order(b1,listing)<>o then raise exception 'Repeated purchase charged twice'; end if;
  if (select total_cents from public.chillbros_market_orders where id=o)<>1083 then raise exception 'Tax rounding incorrect'; end if;
  blocked:=false; begin perform public.chillbros_market_reserve_order(b2,listing); exception when others then blocked:=true; end;
  if not blocked then raise exception 'Exclusive lead oversold'; end if;
  blocked:=false; begin perform public.chillbros_market_claim_checkout(o,b2); exception when others then blocked:=true; end;
  if not blocked then raise exception 'Another buyer claimed checkout'; end if;
  if public.chillbros_market_claim_checkout(o,b1) is not true then raise exception 'Checkout not claimed'; end if;
  if public.chillbros_market_claim_checkout(o,b1) is not false then raise exception 'Concurrent checkout creation permitted'; end if;
  blocked:=false; begin perform public.chillbros_market_settle(o,'fixture-payment-one',999); exception when others then blocked:=true; end;
  if not blocked then raise exception 'Wrong payment amount accepted'; end if;
  if public.chillbros_market_settle(o,'fixture-payment-one',1083)<>'delivered' then raise exception 'Paid order not delivered'; end if;
  if public.chillbros_market_settle(o,'fixture-payment-one',1083)<>'delivered' then raise exception 'Payment retry is not idempotent'; end if;
  if (select count(*) from public.chillbros_market_events where order_id=o and event='delivered')<>1 then raise exception 'Duplicate delivery recorded'; end if;
  if (select lead_snapshot->>'contact_email' from public.chillbros_market_orders where id=o)<>'contact@fixture-business.com' then raise exception 'Delivery snapshot incorrect'; end if;
  blocked:=false; begin update public.chillbros_market_listings set sale_type='shared',max_buyers=3 where id=listing; exception when others then blocked:=true; end;
  if not blocked then raise exception 'Exclusive license changed after purchase'; end if;
  update public.chillbros_market_settings set outreach_enabled=true where id=1;
  update public.chillbros_autopilot_settings set enabled=true,outreach_approval_hold=false where id=1;
  if public.chillbros_market_reserve_email(o) is not null then raise exception 'Buyer consent bypassed'; end if;
  update public.chillbros_market_buyers set automation_enabled=true where id=b1;
  if public.chillbros_market_reserve_email(o) is not null then raise exception 'Missing mailbox bypassed'; end if;
  insert into public.chillbros_market_mailboxes(buyer_id,provider,email,encrypted_credentials,verified_at) values(b1,'smtp','buyer-one@fixture-business.com','Not real credentials; no transport',now());
  receipt:=public.chillbros_market_reserve_email(o);
  if receipt is null then raise exception 'Qualified owned lead did not reserve initial email'; end if;
  update public.chillbros_market_mail_log set status='uncertain' where id=receipt;
  if public.chillbros_market_reserve_email(o) is not null then raise exception 'Ambiguous send retried'; end if;
  delete from public.chillbros_market_mail_log where id=receipt;
  update public.chillbros_autopilot_settings set outreach_approval_hold=true where id=1;
  if public.chillbros_market_reserve_email(o) is not null then raise exception 'Global hold bypassed'; end if;
  update public.chillbros_autopilot_settings set outreach_approval_hold=false where id=1;
  insert into public.chillbros_market_suppressions(buyer_id,contact) values(b1,'contact@fixture-business.com');
  if (public.chillbros_market_qualification(p,b1)->>'eligible')::boolean then raise exception 'Buyer opt-out bypassed'; end if;
  if public.chillbros_market_reserve_email(o) is not null then raise exception 'Opt-out did not stop sending'; end if;
  if not (public.chillbros_market_qualification(p,b2)->>'eligible')::boolean then raise exception 'Buyer-specific opt-out incorrectly changed another buyer'; end if;
  delete from public.chillbros_market_suppressions where buyer_id=b1;
  update public.chillbros_outreach_reviews set contact_checked_at=now()-interval '31 days' where prospect_id=p and sender_key=(select sender_key from public.chillbros_market_buyers where id=b1);
  if (public.chillbros_market_qualification(p,b1)->>'eligible')::boolean then raise exception 'Expired permission accepted'; end if;
  update public.chillbros_outreach_reviews set contact_checked_at=now() where prospect_id=p;
  update public.chillbros_revenue_prospects set contact_email='changed@fixture-business.com' where id=p;
  if (public.chillbros_market_qualification(p,b2)->>'eligible')::boolean then raise exception 'Changed contact retained approval'; end if;
  update public.chillbros_revenue_prospects set contact_email='contact@fixture-business.com' where id=p;
end;
$test$;
do $shared$
declare p uuid:='00000000-0000-4000-8000-000000000022'; listing uuid:='00000000-0000-4000-8000-000000000023'; b1 uuid; b2 uuid; o1 uuid; o2 uuid;
begin
  select id into b1 from public.chillbros_market_buyers where email='buyer-one@fixture-business.com';
  select id into b2 from public.chillbros_market_buyers where email='buyer-two@fixture-business.com';
  insert into public.chillbros_revenue_prospects(id,business_name,city,business_address,contact_email,source_url,signal_observed_at,service_line,score,status,sales_status)
  values(p,'Shared fixture','Test City','900 Fixture Road','shared@fixture-business.com','https://fixture-business.com/shared',now(),'refrigeration',90,'new','new');
  insert into public.chillbros_outreach_reviews(prospect_id,sender_key,verdict,tier,contact_checked_at,source_checked_at,contact_evidence,source_rights_evidence,location_verified,role_verified,outreach_permitted,resale_permitted,sharing_permitted,reviewed_by,snapshot)
  select p,sender_key,'approved','researched_prospect',now(),now(),'Shared fixture direct contact proof','Shared fixture resale and sharing permission',true,true,true,true,true,'00000000-0000-4000-8000-000000000001',public.chillbros_outreach_review_snapshot(p) from public.chillbros_market_buyers;
  insert into public.chillbros_market_listings(id,prospect_id,title,public_summary,city,service_line,tier,sale_type,max_buyers,price_cents,status,created_by)
  values(listing,p,'Shared anonymous fixture','Shared factual research fixture with no need claims','Test City','refrigeration','researched_prospect','shared',2,1000,'published','00000000-0000-4000-8000-000000000001');
  o1:=public.chillbros_market_reserve_order(b1,listing); o2:=public.chillbros_market_reserve_order(b2,listing);
  if o1=o2 then raise exception 'Shared orders not isolated'; end if;
  update public.chillbros_market_orders set status='cancelled' where id=o1;
  if public.chillbros_market_settle(o1,'late-payment-fixture',1083)<>'refund_required' then raise exception 'Late cancellation payment not flagged'; end if;
  if (select lead_snapshot from public.chillbros_market_orders where id=o1) is not null then raise exception 'Cancelled buyer received a lead'; end if;
  if public.chillbros_market_settle(o2,'shared-payment-fixture',1083)<>'delivered' then raise exception 'Second shared buyer not delivered'; end if;
end;
$shared$;
rollback;
select 'Marketplace checks passed' as verification;
