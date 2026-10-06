/* eslint-disable @typescript-eslint/no-require-imports -- Revenue Radar lead finder checks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const read = (f) => fs.readFileSync(f, 'utf8');

function load() {
  const out = ts.transpileModule(read('lib/chillbros/revenue-discovery.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const radar = ts.transpileModule(read('lib/chillbros/revenue-radar.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const radarMod = { exports: {} };
  new Function('require', 'module', 'exports', radar)(require, radarMod, radarMod.exports);
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', out)((id) => (id === 'server-only' ? {} : id === '@/lib/chillbros/revenue-radar' ? radarMod.exports : require(id)), mod, mod.exports);
  return mod.exports;
}
const d = load();
const el = (id, tags) => ({ type: 'node', id, tags });

test('independent, reachable businesses rank above chains of the same type', () => {
  const area = d.SCAN_AREAS[0];
  const leads = d.leadsFromElements([
    el(1, { amenity: 'fast_food', name: "McDonald's", brand: "McDonald's" }),
    el(2, { amenity: 'restaurant', name: "Rosario's", phone: '+1 210 555 0100', website: 'https://example.com', 'addr:street': 'S Alamo St' }),
    el(3, { amenity: 'restaurant', name: 'Taqueria Uno' }),
  ], area, '2026-10-06T00:00:00Z');
  assert.deepEqual(leads.map((l) => l.business_name), ["Rosario's", 'Taqueria Uno', "McDonald's"]);
  assert.equal(leads[0].score, 70 + 4 + 6 + 3 + 2);
  assert.equal(leads[2].score, 55);
  assert.match(leads[0].signal_summary, /Downtown \/ Southtown/);
  assert.match(leads[2].signal_summary, /national\/regional brand/);
  assert.equal(leads[0].contact_phone, '+1 210 555 0100');
});

test('new business types are recognized', () => {
  assert.equal(d.serviceFit({ shop: 'deli' }).service_line, 'refrigeration');
  assert.equal(d.serviceFit({ amenity: 'ice_cream' }).service_line, 'refrigeration');
  assert.equal(d.serviceFit({ shop: 'alcohol' }).service_line, 'refrigeration');
  assert.equal(d.serviceFit({ amenity: 'nursing_home' }).service_line, 'multiple');
  assert.equal(d.serviceFit({ tourism: 'motel' }).service_line, 'hvac_r');
});

test('existing customers and unnamed places are skipped; dedupe key is stable', () => {
  const area = d.SCAN_AREAS[1];
  const leads = d.leadsFromElements([el(4, { amenity: 'bar', name: 'The Esquire Tavern' }), el(5, { amenity: 'bar' }), el(6, { shop: 'bakery', name: 'Bird Bakery' })], area, 'now', new Set([d.nameKey('Esquire Tavern')]));
  assert.deepEqual(leads.map((l) => l.business_name), ['Bird Bakery']);
  assert.equal(leads[0].normalized_key, 'bird bakery|san antonio|auto_discovery|https://www.openstreetmap.org/node/6');
});

test('the daily scan moves to a new area each day and covers all of them', () => {
  const n = d.SCAN_AREAS.length;
  assert.ok(n >= 12);
  const seen = new Set();
  for (let day = 0; day < n; day++) seen.add(d.startAreaIndex('daily', new Date(Date.UTC(2026, 9, 1) + day * 86400000)));
  assert.equal(seen.size, n);
  const cron = read('app/api/cron/revenue-radar/route.ts');
  assert.match(cron, /runLeadScan\(client, \{ mode: "daily"/);
  assert.match(read('app/revenue-radar/actions.ts'), /runLeadScan\(createServiceRoleClient\(\), \{ mode: "manual"/);
});

test('runLeadScan keeps searching areas until it adds enough new leads', async () => {
  const calls = { areas: [] };
  const upserts = [3, 30];
  const client = {
    from(table) {
      if (table === 'chillbros_customers') return { select: () => ({ limit: async () => ({ data: [{ name: 'Bird Bakery' }] }) }) };
      return { upsert: (rows) => ({ select: async () => ({ data: Array.from({ length: Math.min(rows.length, upserts.shift() ?? 0) }, (_, i) => ({ id: i })), error: null }) }) };
    },
  };
  const realFetch = global.fetch;
  global.fetch = async (_url, init) => {
    calls.areas.push(String(init.body));
    return { ok: true, json: async () => ({ elements: Array.from({ length: 40 }, (_, i) => el(i + 1, { amenity: 'restaurant', name: i === 0 ? 'Bird Bakery' : `Spot ${i}` })) }) };
  };
  try {
    const result = await d.runLeadScan(client, { mode: 'daily', actorId: null, target: 25, maxAreas: 4 });
    assert.equal(result.added, 33);
    assert.equal(result.scanned.length, 2, 'stops once the target is reached');
    assert.equal(result.skippedCustomers, 2, 'existing customer skipped in each area');
  } finally { global.fetch = realFetch; }
});
