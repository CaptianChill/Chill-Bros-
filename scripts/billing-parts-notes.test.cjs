/* eslint-disable @typescript-eslint/no-require-imports -- billing save, customer parts and tech notes checks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const read = (f) => fs.readFileSync(f, 'utf8');

function load(file) {
  const out = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', out)(require, mod, mod.exports);
  return mod.exports;
}

test("each customer's parts are ranked by how often their equipment used them", () => {
  const { rankCustomerParts } = load('lib/chillbros/customer-parts-rank.ts');
  const ranked = rankCustomerParts([
    { customerId: 'rosella', partId: 'cap', quantity: 1 },
    { customerId: 'rosella', partId: 'gasket', quantity: 3 },
    { customerId: 'rosella', partId: 'cap', quantity: 1 },
    { customerId: 'other', partId: 'filter', quantity: 1 },
    { customerId: null, partId: 'orphan', quantity: 1 },
  ]);
  assert.deepEqual(ranked.rosella, ['gasket', 'cap']);
  assert.deepEqual(ranked.other, ['filter']);
  assert.equal(Object.keys(ranked).length, 2);
});

test("parts picker puts the customer's parts first and keeps every other part", () => {
  const { splitCustomerParts } = load('lib/chillbros/customer-parts-rank.ts');
  const parts = [{ id: 'cap' }, { id: 'filter' }, { id: 'gasket' }];
  const { mine, rest } = splitCustomerParts(parts, ['gasket', 'cap', 'gone']);
  assert.deepEqual(mine.map((p) => p.id), ['gasket', 'cap']);
  assert.deepEqual(rest.map((p) => p.id), ['filter']);
  assert.deepEqual(splitCustomerParts(parts, undefined).rest.length, 3);
});

test('common tech notes are added on their own line without losing typed text', () => {
  const { appendNote, TECH_NOTE_PICKS } = load('lib/chillbros/tech-note-picks.ts');
  assert.equal(appendNote('', 'Replaced capacitor.'), 'Replaced capacitor.');
  assert.equal(appendNote('Unit iced up.  \n', 'Replaced capacitor.'), 'Unit iced up.\nReplaced capacitor.');
  assert.ok(TECH_NOTE_PICKS.flatMap((g) => g.notes).length >= 20);
});

test('tech notes box is big and offers the common-notes dropdown on both tech screens', () => {
  for (const file of ['components/job-screen-actions.tsx', 'components/technician-job-editor.tsx']) {
    const src = read(file);
    assert.match(src, /rows=\{10\}/, file);
    assert.match(src, /Add a common note/, file);
  }
});

test('billing form saves every line the editor allows', () => {
  const max = Number(/MAX_LINE_ITEMS = (\d+)/.exec(read('app/invoices/new/line-items-editor.tsx'))[1]);
  const read_ = Number(/Array\.from\(\{ length: (\d+) \}, \(_, i\) =>/.exec(read('app/invoices/new/actions.ts'))[1]);
  assert.equal(read_, max);
});

test('unfinished drafts are visible in Billing and cleared after a real create', () => {
  assert.match(read('app/invoices/page.tsx'), /<OpenFormDrafts profileId=\{profile\.id\} paths=\{\["\/invoices\/new"\]\}/);
  assert.match(read('components/form-draft-protector.tsx'), /searchParams\.has\("created"\)/);
  assert.match(read('components/form-draft-protector.tsx'), /does not create or send anything/);
});

test("equipment picker on quotes/invoices only lists the chosen customer's units", () => {
  assert.match(read('components/customer-fields.tsx'), /unit\.customerId === customerId/);
});
