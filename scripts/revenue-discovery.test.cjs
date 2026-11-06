/* eslint-disable @typescript-eslint/no-require-imports -- Revenue Radar lead finder checks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const read = (f) => fs.readFileSync(f, 'utf8');

function load(citySource = async () => { throw new Error('City source unavailable in map fixtures'); }) {
  const out = ts.transpileModule(read('lib/chillbros/revenue-discovery.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const radar = ts.transpileModule(read('lib/chillbros/revenue-radar.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const radarMod = { exports: {} };
  new Function('require', 'module', 'exports', radar)(require, radarMod, radarMod.exports);
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', out)((id) => (id === 'server-only' ? {} : id === './revenue-city-source' ? { discoverCityEstablishments: citySource } : id === '@/lib/chillbros/revenue-radar' ? radarMod.exports : require(id)), mod, mod.exports);
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
  assert.match(cron, /runLeadScan\(client, \{ mode: "scheduled"/);
  assert.match(read('app/revenue-radar/actions.ts'), /runLeadScan\(createServiceRoleClient\(\), \{ mode: "manual"/);
});

test('runLeadScan keeps searching areas until it adds enough new leads', async () => {
  const calls = { areas: [] };
  const upserts = [3, 30];
  const client = {
    from(table) {
      if (table === 'chillbros_customers') return { select: () => ({ order: () => ({ range: async () => ({ data: [{ name: 'Bird Bakery' }] }) }) }) };
      return { select: () => ({ order: () => ({ range: async () => ({ data: [] }) }) }), upsert: (rows) => ({ select: async () => ({ data: Array.from({ length: Math.min(rows.length, upserts.shift() ?? 0) }, (_, i) => ({ id: i })), error: null }) }) };
    },
  };
  const realFetch = global.fetch;
  global.fetch = async (_url, init) => {
    calls.areas.push(String(init.body));
    return { ok: true, json: async () => ({ elements: Array.from({ length: 40 }, (_, i) => el(calls.areas.length * 100 + i + 1, { amenity: 'restaurant', name: i === 0 ? 'Bird Bakery' : `Area ${calls.areas.length} Spot ${i}` })) }) };
  };
  try {
    const result = await d.runLeadScan(client, { mode: 'daily', actorId: null, target: 25, maxAreas: 4 });
    assert.equal(result.added, 33);
    assert.equal(result.scanned.length, 2, 'stops once the target is reached');
    assert.equal(result.skippedCustomers, 2, 'existing customer skipped in each area');
  } finally { global.fetch = realFetch; }
});

test('a hung map server cannot run the scan past its time budget', async () => {
  const client = {
    from(table) {
      if (table === 'chillbros_customers') return { select: () => ({ order: () => ({ range: async () => ({ data: [] }) }) }) };
      if (table === 'chillbros_revenue_prospects') return { select: () => ({ order: () => ({ range: async () => ({ data: [] }) }) }) };
      throw new Error('nothing should be saved');
    },
  };
  const realFetch = global.fetch;
  global.fetch = (_url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' }))));
  const startedAt = Date.now();
  const keepAlive = setInterval(() => {}, 1000); // abort timers don't hold the process open
  try {
    await assert.rejects(d.runLeadScan(client, { mode: 'daily', actorId: null, target: 25, maxAreas: 4, budgetMs: 12000 }), /temporarily unavailable/);
    assert.ok(Date.now() - startedAt < 13000, 'stops at the budget instead of waiting on every server');
  } finally { global.fetch = realFetch; clearInterval(keepAlive); }
});

// Google Maps Platform terms: no storing/caching Places content and no reselling it.
// Radar prospects can end up in lead packs we sell, so discovery must never touch Google.
test('Radar discovery never calls Google Places, even when GOOGLE_PLACES_API_KEY is set', async () => {
  const saved = [];
  const client = {
    from(table) {
      if (table === 'chillbros_customers') return { select: () => ({ order: () => ({ range: async () => ({ data: [] }) }) }) };
      return {
        select: () => ({ order: () => ({ range: async () => ({ data: [] }) }) }),
        upsert: (rows) => { saved.push(...rows); return { select: async () => ({ data: rows.map((_, i) => ({ id: i })), error: null }) }; },
      };
    },
  };
  const realFetch = global.fetch;
  const urls = [];
  global.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes('googleapis.com')) return { ok: true, json: async () => ({ places: [{ id: 'g1', displayName: { text: 'Google Only Cafe' }, nationalPhoneNumber: '(210) 555-0199' }] }) };
    return { ok: true, json: async () => ({ elements: [el(77, { amenity: 'restaurant', name: 'Map Kitchen' })] }) };
  };
  process.env.GOOGLE_PLACES_API_KEY = 'test-key';
  try {
    // Map path (city source unavailable in this fixture).
    const result = await d.runLeadScan(client, { mode: 'daily', actorId: null, target: 1, maxAreas: 2 });
    assert.equal(result.source, 'openstreetmap');
    // City path still runs first when a key is set.
    const records = [{ name: 'City Kitchen', address: '1 Main St', observedAt: '2026-10-20T00:00:00Z', sourceUrl: 'https://www.sa.gov/r.xlsx#row-2' }];
    const city = await load(async () => records).runLeadScan(client, { mode: 'scheduled', actorId: null, target: 1 });
    assert.equal(city.source, 'san-antonio-reports');
    assert.ok(urls.length > 0);
    assert.ok(urls.every((u) => !u.includes('googleapis.com')), `called ${urls.join(', ')}`);
    assert.deepEqual(saved.map((r) => r.business_name), ['Map Kitchen', 'City Kitchen']);
    assert.ok(saved.every((r) => !/google/i.test(JSON.stringify(r))));
  } finally { global.fetch = realFetch; delete process.env.GOOGLE_PLACES_API_KEY; }
});

test('Radar discovery has no Google code path left', () => {
  const src = read('lib/chillbros/revenue-discovery.ts');
  assert.doesNotMatch(src, /process\.env\.GOOGLE_PLACES_API_KEY/);
  assert.doesNotMatch(src, /["'`]https:\/\/places\.googleapis\.com/);
  assert.doesNotMatch(src, /google-places/);
  for (const name of ['searchGooglePlaces', 'leadsFromGooglePlaces', 'tagsFromGooglePlace', 'GOOGLE_QUERIES']) assert.equal(d[name], undefined, name);
  // The Revenue Radar discovery entry points (cron + manual scan) only import the free discovery module.
  for (const f of ['app/api/cron/revenue-radar/route.ts', 'app/revenue-radar/actions.ts']) assert.doesNotMatch(read(f), /google-places|googleapis/);
});

test('independent professional buyers with a phone and website clear the cold-email bar (70)', () => {
  const area = d.SCAN_AREAS[0];
  for (const tags of [{ office: 'property_management' }, { amenity: 'dentist' }, { amenity: 'place_of_worship' }, { leisure: 'fitness_centre' }]) {
    const [lead] = d.leadsFromElements([el(1, { ...tags, name: 'Test Place', phone: '(210) 555-0100', website: 'https://x.example', 'addr:street': '1 Main St' })], area, 'now');
    assert.equal(lead.service_line, 'hvac_r');
    assert.ok(lead.score >= 70, `${JSON.stringify(tags)} scored ${lead.score}`);
  }
});
const source = 'lib/chillbros/revenue-prospects.ts';
function loadProspects() {
  const out = ts.transpileModule(read(source), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', out)(mod, mod.exports);
  return mod.exports;
}

test('dashboard loads all 2087 leads and preserves office assignment scope', async () => {
  const all = Array.from({ length: 2087 }, (_, i) => ({ id: String(i), assigned_salesperson: i % 2 ? 'office-1' : 'office-2' }));
  const client = { from() { let assigned; const q = {
    select() { return q; }, order() { return q; }, eq(_, value) { assigned = value; return q; },
    async range(from, to) { return { data: (assigned ? all.filter(r => r.assigned_salesperson === assigned) : all).slice(from, to + 1), error: null }; }
  }; return q; } };
  const { fetchAllProspects } = loadProspects();
  assert.equal((await fetchAllProspects(client, 'manager', 'owner')).data.length, 2087);
  const office = await fetchAllProspects(client, 'office', 'office-1');
  assert.equal(office.data.length, 1043);
  assert.ok(office.data.every(r => r.assigned_salesperson === 'office-1'));
});

test('scheduled discovery rotates across every area in four hours and runs every 15 minutes', () => {
  const start = Date.UTC(2026, 9, 30);
  const areas = Array.from({ length: d.SCAN_AREAS.length }, (_, i) => d.startAreaIndex('scheduled', new Date(start + i * 900000)));
  assert.equal(new Set(areas).size, d.SCAN_AREAS.length);
  const crons = JSON.parse(read('vercel.json')).crons;
  assert.equal(crons.find(c => c.path === '/api/cron/revenue-radar').schedule, '*/15 * * * *');
});

test('discovered kitchens include hot-side and ventilation fit without claiming verified equipment', () => {
  const area = d.SCAN_AREAS[0];
  const osm = d.leadsFromElements([el(20, { amenity: 'restaurant', name: 'Test Kitchen' })], area, 'now')[0];
  for (const lead of [osm]) {
    for (const term of ['fryers', 'ovens', 'ranges', 'griddles', 'steamers', 'dishwashers', 'hoods', 'exhaust', 'makeup air', 'refrigeration', 'ice', 'HVAC']) assert.ok(lead.signal_summary.includes(term), term);
    assert.equal(lead.signal_verified, false);
    assert.match(lead.signal_summary, /current need unverified/);
    assert.doesNotMatch(lead.signal_summary, /local owner decides/);
  }
});

test('discovery fails closed before searching or writing if a customer or prospect read fails', async () => {
  for (const broken of ['chillbros_customers', 'chillbros_revenue_prospects']) {
    const client = { from(table) { return { select() { return { order() { return { async range() { return table === broken ? { data: null, error: { message: 'unavailable' } } : { data: [], error: null }; } }; } }; } }; } };
    await assert.rejects(d.runLeadScan(client, { mode: 'scheduled', actorId: null }), /could not be read/);
  }
});

test('OSM discovery skips previously imported businesses', async () => {
  const saved = [];
  const client = { from(table) { return {
    select() { return { order() { return { async range() { return { data: table === 'chillbros_customers' ? [] : [{ business_name: 'Known Cafe' }] }; } }; } }; },
    upsert(rows) { saved.push(...rows); return { async select() { return { data: rows.map((_, i) => ({ id: i })), error: null }; } }; }
  }; } };
  const realFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ elements: [el(10, { name: 'Known Cafe', amenity: 'cafe' }), el(11, { name: 'Fresh Kitchen', amenity: 'restaurant' })] }) });
  try {
    await d.runLeadScan(client, { mode: 'scheduled', actorId: null, maxAreas: 1 });
    assert.deepEqual(saved.map(r => r.business_name), ['Fresh Kitchen']);
  } finally { global.fetch = realFetch; }
});

test('renamed map listings are not reimported under a new normalized key', async () => {
  const saved = [];
  const client = { from(table) { return {
    select() { return { order() { return { async range() { return { data: table === 'chillbros_customers' ? [] : [{ business_name: 'Old Name', source_url: 'https://www.openstreetmap.org/node/10' }] }; } }; } }; },
    upsert(rows) { saved.push(...rows); return { async select() { return { data: rows.map((_, i) => ({ id: i })), error: null }; } }; }
  }; } };
  const realFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ elements: [el(10, { name: 'Renamed Kitchen', amenity: 'restaurant' })] }) });
  try {
    const scan = await d.runLeadScan(client, { mode: 'scheduled', actorId: null, maxAreas: 1 });
    assert.equal(scan.added, 0);
    assert.equal(saved.length, 0);
  } finally { global.fetch = realFetch; }
});


test('discovery uses indexed named bounds and retries HTTP 200 runtime-error payloads', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async (_, init) => {
    const query = init.body.get('data');
    assert.match(query, /timeout:12/);
    assert.doesNotMatch(query, /around:/);
    assert.match(query, /\["name"\]/);
    calls++;
    return { ok: true, json: async () => calls === 1 ? { elements: [], remark: 'runtime error: timed out' } : { elements: [el(999, { name: 'Fixture Kitchen', amenity: 'restaurant' })] } };
  };
  try {
    const rows = await d.discoverAreaLeads(d.SCAN_AREAS[0]);
    assert.equal(calls, 2);
    assert.equal(rows[0].business_name, 'Fixture Kitchen');
  } finally { global.fetch = original; }
});


test('official city discovery saves bounded new records and repeat scans preserve customer/source exclusions', async () => {
  const source = 'https://www.sa.gov/report.xlsx';
  const records = ['Existing customer', 'Known kitchen', 'New kitchen', 'Another kitchen'].map((name, i) => ({ name, address: '123 Main St San Antonio, TX 78201', observedAt: '2026-10-20T00:00:00Z', sourceUrl: `${source}#row-${i+2}` }));
  const stored = [{ business_name: 'Known kitchen', source_url: records[1].sourceUrl }];
  const saved = [];
  const client = { from(table) { return {
    select() { return { order() { return { async range() { return { data: table === 'chillbros_customers' ? [{ name: 'Existing customer' }] : stored }; } }; } }; },
    upsert(rows) { saved.push(...rows); stored.push(...rows); return { async select() { return { data: rows.map((_, i) => ({ id: i })), error: null }; } }; },
  }; } };
  const city = load(async () => records);
  const first = await city.runLeadScan(client, { mode: 'scheduled', actorId: null, target: 1 });
  assert.equal(first.source, 'san-antonio-reports');
  assert.equal(first.added, 1);
  assert.equal(first.skippedCustomers, 1);
  assert.equal(saved[0].business_name, 'New kitchen');
  assert.equal(saved[0].signal_verified, false);
  assert.ok(saved[0].score < 80, 'published inspection data alone cannot qualify cold outreach');
  const second = await city.runLeadScan(client, { mode: 'scheduled', actorId: null, target: 1 });
  assert.equal(second.added, 1);
  assert.equal(saved[1].business_name, 'Another kitchen');
  const third = await city.runLeadScan(client, { mode: 'scheduled', actorId: null, target: 1 });
  assert.equal(third.added, 0);
  assert.equal(saved.length, 2);
});
