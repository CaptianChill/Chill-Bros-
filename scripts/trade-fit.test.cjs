/* eslint-disable @typescript-eslint/no-require-imports -- Lead business buyer-trade checks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const src = ts.transpileModule(fs.readFileSync('lib/chillbros/trade-fit.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', src)(require, mod, mod.exports);
const t = mod.exports;

test('covers every buyer trade the lead business sells to', () => {
  assert.deepEqual(t.TRADE_KEYS, ['plumbing', 'electrical', 'hood_cleaning', 'pest_control', 'commercial_cleaning', 'signs', 'low_voltage', 'security']);
});

test('new openings and kitchens fit every trade; other sites skip hood cleaning', () => {
  assert.equal(t.tradeFitsFor({ category: 'opening_remodel', service_line: 'hvac_r' }).length, 8);
  assert.equal(t.tradeFitsFor({ category: 'other', service_line: 'multiple' }).length, 8);
  const market = t.tradeFitsFor({ category: 'other', service_line: 'refrigeration' });
  assert.ok(!market.includes('hood_cleaning'));
  assert.ok(market.includes('pest_control') && market.includes('security'));
});

test('SQL trigger rules match the TypeScript rules', () => {
  const sql = fs.readFileSync('supabase/migrations/20261105170000_revenue_radar_trade_fits.sql', 'utf8');
  assert.match(sql, /p_category = 'opening_remodel' or p_service_line in \('multiple', 'kitchen_equipment', 'exhaust_hood'\)/);
  for (const k of t.TRADE_KEYS) assert.match(sql, new RegExp(`'${k}'`));
});

test('openers are written for the buyer trade, not HVAC', () => {
  const o = t.tradeOpener('pest_control', { business_name: 'Tim Hortons', category: 'opening_remodel' });
  assert.match(o, /Tim Hortons/);
  assert.match(o, /pest program/);
  assert.doesNotMatch(o, /HVAC|refrigeration/i);
  assert.match(t.tradeOpener('hood_cleaning', { business_name: 'Wahkee', category: 'other' }), /hood and exhaust cleaning/);
  assert.equal(t.isTrade('signs'), true);
  assert.equal(t.isTrade('hvac'), false);
});
