/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness. */
// Sales Prep pure rules: who gets AI vs standard cards, status moves, Places matching.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');

const src = ts.transpileModule(fs.readFileSync('lib/chillbros/sales-prep-logic.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', src)(require, mod, mod.exports);
const p = mod.exports;

test('only reachable, contactable leads get the AI card', () => {
  assert.equal(p.wantsAiCard({ contact_phone: '210-555-0100' }), true);
  assert.equal(p.wantsAiCard({ contact_email: 'info@tacos.com' }), true);
  assert.equal(p.wantsAiCard({ contact_phone: ' ', contact_email: null }), false);
  assert.equal(p.wantsAiCard({ contact_phone: '210-555-0100', do_not_contact: true }), false);
});

test('only fresh reachable leads move to ready_to_call', () => {
  assert.equal(p.nextSalesStatus({ contact_phone: '210-555-0100', sales_status: 'new' }), 'ready_to_call');
  assert.equal(p.nextSalesStatus({ contact_phone: '210-555-0100', sales_status: null }), 'ready_to_call');
  assert.equal(p.nextSalesStatus({ sales_status: 'new' }), null);
  assert.equal(p.nextSalesStatus({ contact_phone: '210-555-0100', sales_status: 'contacted' }), null);
  assert.equal(p.nextSalesStatus({ contact_phone: '210-555-0100', sales_status: 'new', do_not_contact: true }), null);
});

test('Places matches must be the same business', () => {
  assert.equal(p.sameBusiness("Justin's Ice Cream", 'Justins Ice Cream Company'), true);
  assert.equal(p.sameBusiness('Blanco BBQ', 'Blanco BBQ & Catering'), true);
  assert.equal(p.sameBusiness('Merit Coffee', 'Starbucks'), false);
  assert.equal(p.sameBusiness('The Cove', 'The Cove'), true);
});

test('Places query uses the address when known', () => {
  assert.equal(p.placesQuery('Astra', '123 Main St, Buda TX', 'Buda'), 'Astra 123 Main St, Buda TX');
  assert.equal(p.placesQuery('Astra', null, 'Buda'), 'Astra Buda, TX');
});
