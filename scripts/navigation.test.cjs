/* eslint-disable @typescript-eslint/no-require-imports -- Static checks that every tool has a home and every visible button works for its role. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (f) => fs.readFileSync(f, 'utf8');

const nav = read('lib/chillbros/nav.ts');
const owner = read('app/owner/page.tsx');

function navRoles(href) {
  const m = nav.match(new RegExp(`href: "${href.replace(/[/-]/g, (c) => `\\${c}`)}"[^\\n]*roles: \\[([^\\]]*)\\]`));
  return m ? m[1].replace(/"/g, '').split(',').map((s) => s.trim()) : null;
}

test('techs get Tech Assist and Training in their menu', () => {
  assert.deepEqual(navRoles('/tech-assist'), ['technician']);
  assert.deepEqual(navRoles('/training'), ['technician']);
});

test('every owner add-on tool is reachable from Owner Access', () => {
  for (const href of ['/reports', '/manager', '/inventory', '/payroll', '/timesheet', '/settings/payments', '/security', '/training', '/3d-studio', '/3d-project-builder', '/create', '/scan-send', '/revenue-radar/opportunities']) {
    assert.ok(owner.includes(`href: "${href}"`), `${href} missing from Owner Access`);
    assert.ok(fs.existsSync(`app${href}/page.tsx`), `${href} page does not exist`);
  }
});

test('payroll is owner/manager only', () => {
  const src = read('app/payroll/page.tsx');
  assert.match(src, /getCurrentStaffProfile\(\)/);
  assert.match(src, /profile\.role !== "manager"\) redirect\("\/"\)/);
});

test('office can open every billing page its menu and buttons point to', () => {
  assert.deepEqual(navRoles('/payments'), ['manager', 'office']);
  assert.deepEqual(navRoles('/invoices'), ['manager', 'office']);
  for (const f of ['app/payments/page.tsx', 'app/invoices/new/page.tsx', 'app/payments/actions.ts', 'app/invoices/new/actions.ts']) {
    const src = read(f);
    assert.doesNotMatch(src, /role !== "manager"\) redirect/, `${f} still blocks office`);
    assert.match(src, /\["manager", "office"\]\.includes\(profile\.role\)/, `${f} has no office check`);
  }
});

test('tech job screen links its tools', () => {
  const src = read('app/technician/page.tsx');
  assert.match(src, /href=\{`\/tech-assist\/\$\{job\.id\}`\}/);
  assert.match(src, /href=\{`\/field-notes\?job=\$\{job\.id\}`\}/);
  assert.match(src, /href="\/parts-lookup"/);
});

test('screen titles match menu labels', () => {
  const titles = read('components/page-title.tsx');
  for (const [href, label] of [['/training', 'Training'], ['/tech-assist', 'Tech Assist'], ['/timesheet', 'Clock'], ['/payments', 'Payments'], ['/agreements', 'Service Plans']]) {
    assert.match(titles, new RegExp(`p === "${href.replace('/', '\\/')}"[^\\n]*"${label}"`), `${href} title should be ${label}`);
  }
});

test('customer-facing messages and plan links say Chill Pros', () => {
  for (const f of ['components/office-document-actions.tsx', 'components/invoice-admin-controls.tsx', 'components/manager-estimate-actions.tsx']) assert.doesNotMatch(read(f), /Chill Bros/, f);
  for (const f of ['app/agreement/[token]/page.tsx', 'app/agreement/[token]/document/page.tsx']) assert.match(read(f), /title: "Chill Pros · Your service plan"/, f);
});
