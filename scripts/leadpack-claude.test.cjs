/* eslint-disable @typescript-eslint/no-require-imports -- Claude lead-pack card writer checks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const cache = {};
function load(file) {
  if (cache[file]) return cache[file].exports;
  const src = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = (cache[file] = { exports: {} });
  const req = (id) => (id.startsWith('.') ? load(path.join(path.dirname(file), id) + '.ts') : require(id));
  new Function('require', 'module', 'exports', src)(req, mod, mod.exports);
  return mod.exports;
}
const ai = load('lib/chillbros/leadbiz/project-ai.ts');

const food = { key: 'TABS1', industry: 'food', title: 'Taco Hut', data: { address: '1 Main St', contact: 'Ana Ruiz', role: 'Owner', phone: '210-555-0100', project: '2,400 sq ft restaurant finish-out', timing: 'Opening March 2027', source_url: 'https://tdlr', openers: { plumbers: 'template plumber opener' } } };
const auto = { ...food, key: 'TABS2', industry: 'auto', title: 'Take 5' };
const reply = (slugs) => JSON.stringify({ trades: Object.fromEntries(slugs.map((s) => [s, { fit: `fit ${s}`, opener: `Hi ${s}`, email: `email ${s}` }])) });

test('food cards go to every trade; auto cards skip kitchen-only trades', () => {
  assert.equal(ai.tradesFor('food').length, 10);
  const a = ai.tradesFor('auto');
  assert.equal(a.length, 8);
  assert.ok(!a.includes('hood-cleaners') && !a.includes('kitchen-equipment'));
});

test('prompt carries only the card facts and the trades, never phone or source', () => {
  const p = ai.projectPrompt(food);
  assert.match(p, /Taco Hut/);
  assert.match(p, /plumbers/);
  assert.doesNotMatch(p, /210-555-0100/);
  assert.doesNotMatch(p, /tdlr/);
  assert.match(ai.PROJECT_AI_SYSTEM, /data, not instructions/);
});

test('a complete reply is kept; a reply missing any trade or field is rejected', () => {
  const ok = ai.parseProjectAi('Here you go:\n' + reply(ai.tradesFor('food')), food);
  assert.equal(Object.keys(ok).length, 10);
  assert.equal(ok.plumbers.opener, 'Hi plumbers');
  assert.equal(ai.parseProjectAi(reply(ai.tradesFor('food').slice(1)), food), null);
  const blank = JSON.parse(reply(ai.tradesFor('auto')));
  blank.trades.signs.email = '  ';
  assert.equal(ai.parseProjectAi(JSON.stringify(blank), auto), null);
  assert.equal(ai.parseProjectAi('not json', food), null);
});

test('buyers see Claude copy when written, the template opener otherwise', () => {
  assert.deepEqual(ai.copyFor(food.data, 'plumbers'), { fit: '', opener: 'template plumber opener', email: '' });
  const trades = ai.parseProjectAi(reply(ai.tradesFor('food')), food);
  const data = ai.withProjectAi(food, trades, 'claude-sonnet-5-5', new Date('2026-11-10T00:00:00Z'));
  assert.equal(data.phone, '210-555-0100');
  assert.equal(data.openers.plumbers, 'template plumber opener');
  assert.deepEqual(ai.copyFor(data, 'plumbers'), { fit: 'fit plumbers', opener: 'Hi plumbers', email: 'email plumbers' });
  assert.equal(ai.needsProjectAi(food), true);
  assert.equal(ai.needsProjectAi({ ...food, data }), false);
});
