/* eslint-disable @typescript-eslint/no-require-imports -- Lead business buyer outreach checks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const src = ts.transpileModule(fs.readFileSync('lib/chillbros/leadbiz/buyers.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', src)(require, mod, mod.exports);
const b = mod.exports;

test('classifies contractor buyers into the 8 trades', () => {
  assert.equal(b.classifyBuyer({ name: 'Alamo City Plumbing' }), 'plumbing');
  assert.equal(b.classifyBuyer({ name: 'Mister Sparky', craft: 'electrician' }), 'electrical');
  assert.equal(b.classifyBuyer({ name: 'SA Hood Cleaning' }), 'hood_cleaning');
  assert.equal(b.classifyBuyer({ name: 'Bug Busters Pest Control' }), 'pest_control');
  assert.equal(b.classifyBuyer({ name: 'Lone Star Janitorial' }), 'commercial_cleaning');
  assert.equal(b.classifyBuyer({ name: 'Texas Sign Co' }), 'signs');
  assert.equal(b.classifyBuyer({ name: 'Hill Country Low Voltage' }), 'low_voltage');
  assert.equal(b.classifyBuyer({ name: 'Guardian Security Systems' }), 'security');
});

test('skips stores, restaurants and non-contractors', () => {
  assert.equal(b.classifyBuyer({ name: 'Ferguson Plumbing Supply' }), null);
  assert.equal(b.classifyBuyer({ name: 'Sparkle Dry Cleaners' }), null);
  assert.equal(b.classifyBuyer({ name: 'Electric Cowboy', amenity: 'bar' }), null);
  assert.equal(b.classifyBuyer({ name: 'Social Security Administration' }), null);
  assert.equal(b.classifyBuyer({}), null);
});

test('builds a buyer row with a usable email and website', () => {
  const r = b.buyerFromElement({ type: 'node', id: 7, tags: { name: 'Alamo City Plumbing', email: 'Info@AlamoPlumb.com', website: 'alamoplumb.com', 'addr:street': 'Main St', 'addr:housenumber': '12' } });
  assert.equal(r.trade, 'plumbing');
  assert.equal(r.email, 'info@alamoplumb.com');
  assert.equal(r.website, 'https://alamoplumb.com');
  assert.equal(r.source_url, 'https://www.openstreetmap.org/node/7');
  assert.equal(b.buyerFromElement({ type: 'node', id: 8, tags: { name: 'Taco Hut', amenity: 'restaurant' } }), null);
});

test('sends only weekdays 9am-2:59pm Central', () => {
  assert.equal(b.inSendWindow(new Date('2026-11-05T16:00:00Z')), true);  // Thu 10am CST
  assert.equal(b.inSendWindow(new Date('2026-11-05T19:00:00Z')), true);  // Thu 1pm
  assert.equal(b.inSendWindow(new Date('2026-11-05T21:00:00Z')), false); // Thu 3pm
  assert.equal(b.inSendWindow(new Date('2026-11-07T16:00:00Z')), false); // Saturday
});

test('offer email is trade-specific, has all links, address and unsubscribe', () => {
  const { subject, text } = b.offerEmail({ business_name: 'Bug Busters', trade: 'pest_control' }, 'https://x/u/leads?c=a&s=b');
  assert.match(subject, /pest control companies/);
  for (const url of Object.values(b.PAY_LINKS)) assert.ok(text.includes(url));
  assert.match(text, /15226 Preston Pass, San Antonio, TX 78247/);
  assert.match(text, /Unsubscribe: https:\/\/x\/u\/leads\?c=a&s=b/);
  assert.doesNotMatch(text, /HVAC/);
  assert.match(b.offerEmail({ business_name: 'X', trade: 'signs' }, 'u', true).subject, /^Re: /);
});

test('the map query never asks the free map servers for an unsupported regex token', () => {
  assert.doesNotMatch(b.buyerQuery(), /\\b/);
});
