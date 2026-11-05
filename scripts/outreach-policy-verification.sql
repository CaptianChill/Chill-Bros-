-- No transport calls. All settings, prospect and review fixtures roll back.
begin;
do $test$
declare p uuid; reviewer uuid; review uuid; reservation uuid; receipt uuid;
  email text; key text; payload jsonb; decision jsonb; snap jsonb; blocked boolean;
begin
  select id into strict p from public.chillbros_revenue_prospects order by id limit 1;
  select id into strict reviewer from public.chillbros_profiles where role::text='manager' and status::text='active' order by id limit 1;
  email:='policy-fixture-'||p::text||'@fixture-business.com';
  update public.chillbros_autopilot_settings set enabled=true,outreach_approval_hold=false,cold_email_enabled=true,cold_daily_cap=100000 where id=1;
  update public.chillbros_revenue_prospects set business_name='Policy fixture '||p::text,business_address='Fixture location '||p::text,
    contact_email=email,source_url='https://fixture-business.com/'||p::text,score=99,do_not_contact=false,outreach_done=false,
    status='new',sales_status='new',outreach_step=0 where id=p;
  key:='cold:'||email||':0';
  payload:=jsonb_build_object('lane','cold','channel','email','step',0,'recipient',email,'prospect_id',p,'subject','Rollback-only fixture','body','Never transported');
  if (public.chillbros_outreach_policy_check(p)->>'eligible')::boolean then raise exception 'Unreviewed score 99 passed'; end if;
  if public.chillbros_reserve_outreach(key,payload) is not null then raise exception 'Unreviewed lead reserved'; end if;
  snap:=public.chillbros_outreach_review_snapshot(p);
  insert into public.chillbros_outreach_reviews(prospect_id,sender_key,verdict,tier,contact_checked_at,source_checked_at,
    contact_evidence,source_rights_evidence,location_verified,role_verified,outreach_permitted,reviewed_by,snapshot)
  values(p,'chill-pros','approved','researched_prospect',now(),now(),'Rollback fixture: direct business contact confirmed','Rollback fixture: exact outreach use permission documented',true,true,true,reviewer,snap) returning id into review;
  if not (public.chillbros_outreach_policy_check(p)->>'eligible')::boolean then raise exception 'Reviewed prospect did not pass'; end if;
  reservation:=public.chillbros_reserve_outreach(key,payload);
  if reservation is null then raise exception 'Reviewed prospect did not reserve'; end if;
  select qualification_review_id into receipt from public.chillbros_outreach_log where id=reservation;
  if receipt is distinct from review then raise exception 'Reservation lost evidence receipt'; end if;
  if public.chillbros_reserve_outreach(key,payload) is not null then raise exception 'Duplicate reservation passed'; end if;
  if public.chillbros_reserve_outreach('wrong-key',payload) is not null then raise exception 'Noncanonical key passed'; end if;
  if public.chillbros_reserve_outreach(key,payload||jsonb_build_object('outreach_sender_key','buyer-fixture')) is not null then raise exception 'Buyer transport reused owner credentials'; end if;

  update public.chillbros_autopilot_settings set outreach_approval_hold=true where id=1;
  if (public.chillbros_outreach_policy_check(p)->>'eligible')::boolean then raise exception 'Global hold bypassed'; end if;
  update public.chillbros_autopilot_settings set outreach_approval_hold=false,cold_email_enabled=false where id=1;
  if (public.chillbros_outreach_policy_check(p)->>'eligible')::boolean then raise exception 'Cold toggle bypassed'; end if;
  update public.chillbros_autopilot_settings set cold_email_enabled=true where id=1;

  update public.chillbros_revenue_prospects set contact_email='changed-'||email where id=p;
  if (public.chillbros_outreach_policy_check(p)->>'eligible')::boolean then raise exception 'Changed contact retained approval'; end if;
  update public.chillbros_revenue_prospects set contact_email=email where id=p;
  insert into public.chillbros_outreach_suppressions(contact,reason) values(email,'Rollback-only fixture');
  if (public.chillbros_outreach_policy_check(p)->>'eligible')::boolean then raise exception 'Suppression bypassed'; end if;
  delete from public.chillbros_outreach_suppressions where contact=email;
  update public.chillbros_revenue_prospects set do_not_contact=true where id=p;
  if (public.chillbros_outreach_policy_check(p)->>'eligible')::boolean then raise exception 'DNC bypassed'; end if;
  update public.chillbros_revenue_prospects set do_not_contact=false where id=p;

  -- postgres-only fixture aging: service_role has no UPDATE privilege on reviews.
  update public.chillbros_outreach_reviews set contact_checked_at=now()-interval '31 days' where id=review;
  if (public.chillbros_outreach_policy_check(p)->>'eligible')::boolean then raise exception 'Expired contact passed'; end if;
  update public.chillbros_outreach_reviews set contact_checked_at=now(),source_checked_at=now()-interval '31 days' where id=review;
  if (public.chillbros_outreach_policy_check(p)->>'eligible')::boolean then raise exception 'Expired source rights passed'; end if;
  update public.chillbros_outreach_reviews set source_checked_at=now(),tier='confirmed_need',need_confirmed_at=now()-interval '8 days' where id=review;
  if (public.chillbros_outreach_policy_check(p)->>'eligible')::boolean then raise exception 'Expired need passed'; end if;
  update public.chillbros_outreach_reviews set tier='researched_prospect',need_confirmed_at=null where id=review;

  blocked:=false;
  begin
    insert into public.chillbros_outreach_reviews(prospect_id,sender_key,verdict,tier,reviewed_by,snapshot)
    values(p,'chill-pros','approved','researched_prospect',reviewer,snap);
  exception when others then blocked:=true; end;
  if not blocked then raise exception 'Empty approval evidence accepted'; end if;
  blocked:=false;
  begin
    insert into public.chillbros_outreach_reviews(prospect_id,sender_key,verdict,tier,reviewed_by,snapshot)
    values(p,'chill-pros','blocked','researched_prospect',reviewer,'{}'::jsonb);
  exception when others then blocked:=true; end;
  if not blocked then raise exception 'Stale review form accepted'; end if;

  insert into public.chillbros_outreach_senders(sender_key,display_name,kind) values('buyer-policy-fixture','Rollback-only buyer','buyer');
  if (public.chillbros_outreach_policy_check(p,'buyer-policy-fixture')->>'eligible')::boolean then raise exception 'Buyer inherited owner approval'; end if;
  insert into public.chillbros_outreach_reviews(prospect_id,sender_key,verdict,tier,contact_checked_at,source_checked_at,
    contact_evidence,source_rights_evidence,location_verified,role_verified,outreach_permitted,reviewed_by,snapshot)
  values(p,'buyer-policy-fixture','approved','researched_prospect',now(),now(),'Rollback fixture: direct business contact confirmed','Rollback fixture: exact outreach use permission documented',true,true,true,reviewer,snap);
  update public.chillbros_outreach_senders set transport_ready=true,approval_hold=false where sender_key='buyer-policy-fixture';
  decision:=public.chillbros_outreach_policy_check(p,'buyer-policy-fixture');
  if (decision->>'eligible')::boolean or not (decision->'reasons' ? 'Buyer resale rights and sharing permission are required') then raise exception 'Buyer rights gate bypassed'; end if;

  insert into public.chillbros_outreach_reviews(prospect_id,sender_key,verdict,tier,reviewed_by,snapshot)
  values(p,'chill-pros','blocked','researched_prospect',reviewer,snap);
  if (public.chillbros_outreach_policy_check(p)->>'eligible')::boolean then raise exception 'Latest revocation ignored'; end if;
  update public.chillbros_outreach_log set status='sent' where id=reservation;
  if not exists(select 1 from public.chillbros_outreach_log where id=reservation and status='sent' and qualification_review_id=review) then raise exception 'Accepted delivery could not be finalized after revocation'; end if;
  blocked:=false;
  begin
    insert into public.chillbros_outreach_log(lane,channel,recipient,prospect_id,subject,body,status)
    values('cold','email',email,p,'Direct bypass fixture','Never transported','sent');
  exception when others then blocked:=true; end;
  if not blocked then raise exception 'Direct sent-log insert bypassed policy'; end if;
  if has_table_privilege('service_role','public.chillbros_outreach_reviews','UPDATE') then raise exception 'Service role can rewrite reviews'; end if;
  if has_function_privilege('anon','public.chillbros_outreach_policy_check(uuid,text)','EXECUTE') then raise exception 'Anonymous policy RPC exposed'; end if;
end;
$test$;
rollback;
select 'Policy integration checks passed; all fixture data rolled back; no transport invoked' as verification;
