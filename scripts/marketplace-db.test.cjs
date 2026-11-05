/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require(process.env.RADAR_POLICY_PGLITE_MODULE || '@electric-sql/pglite');
test('marketplace SQL enforces atomic inventory, verified settlement, sender permissions, OTP attempts and private data', { timeout: 120000 }, async () => {
  const db = new PGlite();
  try {
    const baseline = fs.readFileSync('scripts/outreach-policy-db.test.cjs', 'utf8').match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
    await db.exec(baseline);
    for (const name of ['20261104184808_radar_outreach_policy_v1.sql','20261104190829_radar_outreach_policy_hardening.sql','20261105022644_lead_marketplace_v1.sql']) await db.exec(fs.readFileSync('supabase/migrations/' + name, 'utf8'));
    const result = await db.exec(fs.readFileSync('scripts/marketplace-verification.sql', 'utf8'));
    assert.match(result.at(-1).rows[0].verification, /passed/);
    assert.equal((await db.query('select count(*)::int n from chillbros_market_orders')).rows[0].n, 0);
    assert.equal((await db.query('select sales_enabled from chillbros_market_settings')).rows[0].sales_enabled, false);
  } finally { await db.close(); }
});
