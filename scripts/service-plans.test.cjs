/* eslint-disable @typescript-eslint/no-require-imports -- Pricing + wiring checks for custom service plans. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const load = (file) => { const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText; const mod = { exports: {} }; new Function('module', 'exports', out)(mod, mod.exports); return mod.exports; };
const { calculatePlanPricing, PLAN_STARTERS } = load('lib/chillbros/service-plan-pricing.ts');
const base = { calculationMode: 'hourly', visitsPerMonth: 2, hoursPerVisit: 3, hourlyRate: 95, monthlyFlatRate: 0, discountType: null, discountValue: 0 };

test('hourly plan = visits x hours x rate', () => { assert.deepEqual(calculatePlanPricing(base), { monthlySubtotal: 570, discountAmount: 0, monthlyTotal: 570 }); });
test('flat plan ignores hourly math', () => { assert.equal(calculatePlanPricing({ ...base, calculationMode: 'flat', monthlyFlatRate: '349.99' }).monthlyTotal, 349.99); });
test('percent and dollar discounts are capped at subtotal', () => {
  assert.equal(calculatePlanPricing({ ...base, discountType: 'percent', discountValue: 10 }).monthlyTotal, 513);
  assert.equal(calculatePlanPricing({ ...base, discountType: 'percent', discountValue: 250 }).monthlyTotal, 0);
  assert.equal(calculatePlanPricing({ ...base, discountType: 'dollar', discountValue: 9999 }).monthlyTotal, 0);
  assert.equal(calculatePlanPricing({ ...base, discountType: 'none', discountValue: 50 }).monthlyTotal, 570);
});
test('bad input never produces negative or NaN totals', () => {
  const r = calculatePlanPricing({ ...base, visitsPerMonth: '', hoursPerVisit: 'abc', hourlyRate: -5 });
  assert.equal(r.monthlyTotal, 0); assert.ok(Number.isFinite(r.monthlySubtotal));
});
test('starter packages are valid server inputs', () => {
  assert.ok(PLAN_STARTERS.length >= 3);
  for (const s of PLAN_STARTERS) { assert.ok(s.visitsPerMonth >= 1 && s.visitsPerMonth <= 31); assert.ok(s.hoursPerVisit > 0 && s.hoursPerVisit <= 24); assert.ok(s.title && s.servicesIncluded); }
});
test('server and screen share one pricing function', () => {
  assert.match(fs.readFileSync('lib/chillbros/service-agreement-actions.ts', 'utf8'), /calculatePlanPricing\(input\)/);
  assert.match(fs.readFileSync('components/service-agreement-admin.tsx', 'utf8'), /calculatePlanPricing\(/);
});
test('service plans are in the main menu and customer profile deep-links', () => {
  assert.match(fs.readFileSync('lib/chillbros/nav.ts', 'utf8'), /href: "\/agreements", label: "Service Plans"[^\n]*roles: \["manager", "office"\]/);
  const profile = fs.readFileSync('app/customers/[id]/page.tsx', 'utf8');
  assert.match(profile, /\/agreements\?customer=/); assert.match(profile, /\/agreements\?plan=/);
});
test('verbal approval requires office/manager and only moves waiting plans', () => {
  const src = fs.readFileSync('lib/chillbros/service-agreement-actions.ts', 'utf8');
  const fn = src.slice(src.indexOf('export async function recordVerbalAgreementApprovalAction'));
  assert.match(fn, /requireOfficeOrManager\(\)/); assert.match(fn, /\.in\("status", \["draft", "proposed"\]\)/); assert.match(fn, /chillbros_customer_service_history/);
});
