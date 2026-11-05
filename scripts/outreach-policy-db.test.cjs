/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.RADAR_POLICY_PGLITE_MODULE || '@electric-sql/pglite');

test('PostgreSQL enforces qualification, expiry, revocation, sender isolation and immutable evidence', { timeout: 120000 }, async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      alter default privileges in schema public grant all on tables to service_role;
      create table public.chillbros_profiles(id uuid primary key,role text,status text);
      create table public.chillbros_revenue_prospects(
        id uuid primary key, business_name text, city text,business_address text,contact_email text,
        contact_name text,contact_role text,contact_phone text,source_url text,signal_summary text,
        signal_observed_at timestamptz,service_line text,score integer,status text,sales_status text,
        do_not_contact boolean default false,outreach_done boolean default false,outreach_step integer default 0
      );
      create table public.chillbros_customers(id uuid primary key,name text,email text);
      create table public.chillbros_revenue_contacts(email text,do_not_contact boolean default false);
      create table public.chillbros_outreach_suppressions(contact text primary key,reason text);
      create table public.chillbros_autopilot_settings(id integer primary key,enabled boolean,
        outreach_approval_hold boolean,cold_email_enabled boolean,cold_daily_cap integer,reactivation_daily_cap integer);
      create table public.chillbros_outreach_log(id uuid primary key default gen_random_uuid(),delivery_key text,
        lane text,step integer,channel text,recipient text,prospect_id uuid,customer_id uuid,inbound_lead_id uuid,
        subject text,body text,status text,error text,created_at timestamptz default now());
      create unique index delivery_once on public.chillbros_outreach_log(delivery_key) where delivery_key is not null;
      insert into public.chillbros_profiles values('00000000-0000-4000-8000-000000000001','manager','active');
      insert into public.chillbros_revenue_prospects(id,business_name,score,status,sales_status)
        values('00000000-0000-4000-8000-000000000002','Untouched fixture',99,'new','new');
      insert into public.chillbros_autopilot_settings values(1,true,true,false,15,40);
    `);
    for (const name of ['20261104184808_radar_outreach_policy_v1.sql','20261104190829_radar_outreach_policy_hardening.sql']) {
      await db.exec(fs.readFileSync(path.join('supabase/migrations', name), 'utf8'));
    }
    const result = await db.exec(fs.readFileSync('scripts/outreach-policy-verification.sql', 'utf8'));
    assert.match(result.at(-1).rows[0].verification, /checks passed/);
    const state = await db.query(`select (select outreach_approval_hold from chillbros_autopilot_settings where id=1) hold,
      (select count(*)::int from chillbros_outreach_reviews) reviews,(select count(*)::int from chillbros_outreach_log) deliveries,
      (select business_name from chillbros_revenue_prospects limit 1) business`);
    assert.deepEqual(state.rows[0], { hold: true, reviews: 0, deliveries: 0, business: 'Untouched fixture' });
  } finally { await db.close(); }
});
