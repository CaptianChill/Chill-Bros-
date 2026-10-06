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

test('techs get Training in their menu; Tech Assist opens from each job', () => {
  assert.deepEqual(navRoles('/training'), ['technician']);
  assert.equal(navRoles('/tech-assist'), null);
  assert.match(read('app/technician/page.tsx'), /href=\{`\/tech-assist\/\$\{job\.id\}`\}/);
});

function loadNav() {
  const ts = require('typescript');
  const out = ts.transpileModule(nav, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', out)((id) => (id === 'lucide-react' ? new Proxy({}, { get: () => () => null }) : require(id)), mod, mod.exports);
  return mod.exports;
}

test('every role gets the simple flow: few tabs, short More list', () => {
  const n = loadNav();
  const labels = (role) => n.getPrimaryTabs(role).map((t) => t.label);
  assert.deepEqual(labels('manager'), ['Home', 'Work', 'Schedule', 'Billing']);
  assert.deepEqual(labels('office'), ['Home', 'Work', 'Schedule', 'Billing']);
  assert.deepEqual(labels('technician'), ['My Jobs', 'Notes', 'Clock']);
  const more = (role) => n.navItems.filter((i) => i.roles.includes(role) && !n.getPrimaryTabs(role).some((t) => t.href === i.href)).map((i) => i.label);
  assert.deepEqual(more('manager'), ['Customers', 'Sales', 'Parts Pro']);
  assert.deepEqual(more('office'), ['Customers', 'Sales', 'Parts Pro']);
  assert.deepEqual(more('technician'), ['Parts Pro', 'Training', 'Send a Lead']);
});

test('merged menu entries switch between their pages with section tabs', () => {
  const n = loadNav();
  const at = (path, role = 'manager') => { const s = n.sectionTabsFor(path, role); return s && [s.tabs.map((t) => t.label), s.activeHref]; };
  assert.deepEqual(at('/dispatch'), [['Board', 'Calendar'], '/dispatch']);
  assert.deepEqual(at('/schedule'), [['Board', 'Calendar'], '/schedule']);
  assert.deepEqual(at('/payments'), [['Quotes & Invoices', 'Payments'], '/payments']);
  assert.deepEqual(at('/invoices/new', 'office'), [['Quotes & Invoices', 'Payments'], '/invoices']);
  assert.deepEqual(at('/revenue-radar/tasks'), [['Leads', 'Service Plans', 'Sales Tasks'], '/revenue-radar/tasks']);
  assert.deepEqual(at('/revenue-radar/abc-123'), [['Leads', 'Service Plans', 'Sales Tasks'], '/revenue-radar']);
  assert.equal(n.sectionTabsFor('/revenue-radar/handoffs', 'technician'), null);
  assert.equal(n.sectionTabsFor('/dispatch', 'technician'), null);
  assert.equal(n.sectionTabsFor('/customers', 'manager'), null);
  // Every page behind a tab still exists.
  for (const group of n.SECTION_TABS) for (const tab of group) assert.ok(fs.existsSync(`app${tab.href}/page.tsx`), tab.href);
  assert.ok(n.isNavItemActive('/payments', '/invoices'));
  assert.ok(n.isNavItemActive('/schedule', '/dispatch'));
  assert.ok(n.isNavItemActive('/agreements', '/revenue-radar'));
  assert.ok(!n.isNavItemActive('/revenue-radar/handoffs', '/revenue-radar'));
});

test('owner sees tech field notes waiting on Work', () => {
  const work = read('app/work/page.tsx');
  assert.match(work, /profile\.role === "manager" \? getFieldNoteInboxCounts\(\)/);
  assert.match(work, /href="\/owner\/field-notes"/);
});

test('every owner add-on tool is reachable from Owner Access', () => {
  for (const href of ['/reports', '/manager', '/inventory', '/payroll', '/timesheet', '/settings/payments', '/security', '/training', '/create', '/scan-send', '/revenue-radar/opportunities']) {
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
