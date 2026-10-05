/* eslint-disable @typescript-eslint/no-require-imports -- Runs the real service-plan generator against an in-memory database double. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function makeDb(seed) {
  const tables = { chillbros_service_agreements: [], chillbros_customer_service_history: [], chillbros_jobs: [], chillbros_invoices: [], ...seed };
  let n = 0;
  const rpcCalls = [];
  function query(table) {
    const filters = []; let mode = 'select'; let payload = null; let limitN = Infinity;
    const rows = () => tables[table].filter((r) => filters.every((f) => f(r)));
    const api = {
      select() { return api; },
      eq(k, v) { filters.push((r) => r[k] === v); return api; },
      neq(k, v) { filters.push((r) => r[k] !== v); return api; },
      in(k, vs) { filters.push((r) => vs.includes(r[k])); return api; },
      like(k, pattern) { const re = new RegExp('^' + pattern.split('%').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'); filters.push((r) => re.test(String(r[k] ?? ''))); return api; },
      limit(x) { limitN = x; return api; },
      insert(v) { mode = 'insert'; payload = v; return api; },
      update(v) { mode = 'update'; payload = v; return api; },
      delete() { mode = 'delete'; return api; },
      run() {
        if (mode === 'insert') { const row = { id: `id-${++n}`, ...payload }; tables[table].push(row); return { data: row, error: null }; }
        if (mode === 'update') { for (const r of rows()) Object.assign(r, payload); return { data: null, error: null }; }
        if (mode === 'delete') { const keep = tables[table].filter((r) => !filters.every((f) => f(r))); tables[table] = keep; return { data: null, error: null }; }
        return { data: rows().slice(0, limitN), error: null };
      },
      maybeSingle() { const r = api.run(); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }); },
      single() { return api.maybeSingle(); },
      then(res, rej) { return Promise.resolve(api.run()).then(res, rej); },
    };
    return api;
  }
  const client = {
    from: query,
    rpc(name, args) {
      rpcCalls.push({ name, args });
      const id = `inv-${++n}`;
      tables.chillbros_invoices.push({ id, job_id: args.p_job_id, number: args.p_invoice_number, lines: args.p_line_items, status: 'draft' });
      return { single: () => Promise.resolve({ data: { estimate_id: id, estimate_number: args.p_invoice_number }, error: null }) };
    },
  };
  return { tables, client, rpcCalls };
}

function load(db) {
  const out = ts.transpileModule(fs.readFileSync('lib/chillbros/service-plan-generation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  let seq = 0;
  new Function('require', 'module', 'exports', out)((id) => {
    if (id === 'server-only') return {};
    if (id === '@/lib/supabase/service-client') return { createServiceRoleClient: () => db.client };
    if (id === '@/lib/chillbros/document-number') return { simpleDocumentNumber: () => `INV-${++seq}` };
    return require(id);
  }, mod, mod.exports);
  return mod.exports;
}

const plan = (over = {}) => ({ id: 'plan1', customer_id: 'c1', agreement_number: 'SA-7', title: 'Standard Monthly Maintenance Plan', status: 'active', visits_per_month: 2, hours_per_visit: 3, preferred_days: ['Tuesday'], preferred_time_window: '8 AM–12 PM', start_date: '2026-10-01', end_date: null, services_included: 'Coil cleaning', customer_preferences: null, setup_fee: 150, monthly_total: 570, customer: { address: '1 Main St' }, ...over });

test('activating creates one unassigned visit per included visit and one unsent invoice', async () => {
  const db = makeDb({ chillbros_service_agreements: [plan()] });
  const { generatePlanMonth } = load(db);
  const r = await generatePlanMonth('plan1', '2026-10', 'owner');
  assert.deepEqual({ ok: r.ok, created: r.created, visits: r.visits }, { ok: true, created: true, visits: 2 });
  const visits = db.tables.chillbros_jobs.filter((j) => j.scope.startsWith('Service plan SA-7 · October 2026 · visit'));
  assert.equal(visits.length, 2);
  for (const v of visits) { assert.equal(v.assigned_tech_id, null); assert.equal(v.status, 'scheduled'); assert.equal(v.location, '1 Main St'); assert.match(v.scope, /Coil cleaning/); assert.match(v.scope, /Preferred days: Tuesday/); }
  assert.equal(db.rpcCalls.length, 1);
  const inv = db.tables.chillbros_invoices[0];
  assert.equal(inv.status, 'awaiting_approval');
  assert.equal(inv.payment_status, 'unpaid');
  assert.deepEqual(inv.lines.map((l) => l.unit_price), [570, 150]);
});

test('each month runs once: a second run (cron after activation) creates nothing', async () => {
  const db = makeDb({ chillbros_service_agreements: [plan()] });
  const { generatePlanMonth } = load(db);
  await generatePlanMonth('plan1', '2026-10');
  const again = await generatePlanMonth('plan1', '2026-10');
  assert.equal(again.created, false);
  assert.equal(db.rpcCalls.length, 1);
  assert.equal(db.tables.chillbros_jobs.filter((j) => j.scope.includes('visit')).length, 2);
});

test('setup fee is billed only in the first month', async () => {
  const db = makeDb({ chillbros_service_agreements: [plan()] });
  const { generatePlanMonth } = load(db);
  await generatePlanMonth('plan1', '2026-10');
  await generatePlanMonth('plan1', '2026-11');
  assert.deepEqual(db.tables.chillbros_invoices[1].lines.map((l) => l.unit_price), [570]);
});

test('inactive plans and months outside the plan dates are skipped', async () => {
  const db = makeDb({ chillbros_service_agreements: [plan({ status: 'accepted' }), plan({ id: 'plan2', start_date: '2026-12-01' }), plan({ id: 'plan3', end_date: '2026-09-30' })] });
  const { generatePlanMonth } = load(db);
  assert.equal((await generatePlanMonth('plan1', '2026-10')).created, false);
  assert.equal((await generatePlanMonth('plan2', '2026-10')).created, false);
  assert.equal((await generatePlanMonth('plan3', '2026-10')).created, false);
  assert.equal(db.rpcCalls.length, 0);
  assert.equal(db.tables.chillbros_jobs.length, 0);
});

test('month helpers use the San Antonio calendar', () => {
  const { businessMonth, monthLabel, planCoversMonth } = load(makeDb({}));
  assert.equal(businessMonth(new Date('2026-11-01T03:00:00Z')), '2026-10'); // Oct 31, 10pm in Texas
  assert.equal(monthLabel('2026-02'), 'February 2026');
  assert.equal(planCoversMonth({ start_date: '2026-02-28', end_date: null }, '2026-02'), true);
});

test('activation, cron route and schedule are wired', () => {
  assert.match(fs.readFileSync('lib/chillbros/service-agreement-actions.ts', 'utf8'), /status === "active"[\s\S]*generatePlanMonth\(id/);
  const route = fs.readFileSync('app/api/cron/service-plans/route.ts', 'utf8');
  assert.match(route, /Bearer \$\{secret\}/);
  assert.ok(JSON.parse(fs.readFileSync('vercel.json', 'utf8')).crons.some((c) => c.path === '/api/cron/service-plans'));
});
