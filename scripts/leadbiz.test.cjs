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
  assert.equal(b.classifyBuyer({ name: 'Alamo Air Conditioning & Heating' }), 'hvac_refrigeration');
  assert.equal(b.classifyBuyer({ name: 'Lone Star Restaurant Equipment Repair' }), 'kitchen_equipment');
  assert.match(b.offerEmail({ business_name: 'K', trade: 'kitchen_equipment' }, 'u').subject, /^16 new .*kitchen equipment/);
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
  assert.match(text, /We work these job sites every week/);
  assert.match(b.offerEmail({ business_name: 'X', trade: 'signs' }, 'u', true).subject, /^Re: /);
  assert.match(subject, /^29 new/);
  assert.match(text, /car washes, oil change/);
  assert.match(b.offerEmail({ business_name: 'H', trade: 'hood_cleaning' }, 'u').subject, /^16 new/);
  assert.doesNotMatch(b.offerEmail({ business_name: 'H', trade: 'hood_cleaning' }, 'u').text, /car wash/);
});

test('the map query never asks the free map servers for an unsupported regex token', () => {
  for (const q of b.buyerQueries()) { assert.doesNotMatch(q, /\\b/); assert.match(q, /timeout:15/); }
});

test('google rotation covers every trade and area, one search per run', () => {
  const seen = new Set();
  for (let i = 0; i < 8 * 12; i++) { const r = b.googleRotation(i, 12); seen.add(r.trade + '@' + r.area); }
  assert.equal(seen.size, 96);
  assert.deepEqual(b.googleRotation(0, 12), { trade: 'plumbing', area: 0 });
  assert.equal(b.buyerFromGooglePlace, undefined, 'no builder that copies Google Places fields into a row');
});

test('a Google-found buyer row holds only what the business\'s own site says, plus place_id', () => {
  const html = '<html><head><title>Commercial Plumbing San Antonio | Alamo City Plumbing</title></head><body>…</body></html>';
  const row = b.buyerFromOwnSite({ placeId: 'abc', trade: 'plumbing', website: 'https://alamocityplumbing.com', html, email: 'info@alamocityplumbing.com', phone: '2105550111' });
  assert.deepEqual(row, { business_name: 'Alamo City Plumbing', trade: 'plumbing', email: 'info@alamocityplumbing.com', phone: '2105550111', website: 'https://alamocityplumbing.com', address: null, source_url: 'https://www.google.com/maps/place/?q=place_id:abc' });
  assert.equal(b.siteBusinessName('<meta property="og:site_name" content="Bug Busters &amp; Co">', 'https://bugbusters.com'), 'Bug Busters & Co');
  assert.equal(b.siteBusinessName('<title>Home</title>', 'https://www.lonestarsigns.com'), 'lonestarsigns.com');
  assert.equal(b.buyerFromOwnSite({ placeId: 'x', trade: 'plumbing', website: 'https://ferguson.com', html: '<title>Ferguson Plumbing Supply</title>', email: null, phone: null }), null);
  assert.equal(b.buyerFromOwnSite({ placeId: 'y', trade: 'plumbing', website: 'https://down.com', html: '', email: null, phone: null }), null, 'site did not load: nothing to save');
});

test('buyer-facing copy never says "Chill Pros" (legal entity Chill Professionals LLC is fine)', () => {
  for (const trade of Object.keys(b.TRADE_LABEL)) for (const f of [false, true]) {
    const { subject, text } = b.offerEmail({ business_name: 'X', trade }, 'https://x/u/leads?c=a&s=b', f);
    assert.doesNotMatch(subject + text, /chill\s*pros\b/i);
    assert.match(text, /Chill Professionals LLC, 15226 Preston Pass/);
    assert.match(text, /Unsubscribe: https:\/\/x\/u\/leads/);
  }
  for (const file of ['app/new-openings/page.tsx', 'app/new-openings/flyer.tsx', 'app/new-openings/loading.tsx', 'app/u/leads/loading.tsx', 'app/u/leads/page.tsx', 'lib/chillbros/leadbiz/buyers.ts', 'lib/chillbros/leadbiz/buyer-scripts.ts', 'sites/new-openings/lib/brand.ts', 'sites/new-openings/app/page.tsx']) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /chill\s*pros\b/i, file);
  }
  // The unsubscribe page must not wrap itself in the Chill Pros customer frame/logo.
  assert.doesNotMatch(fs.readFileSync('app/u/leads/page.tsx', 'utf8'), /CustomerFrame|PlatformLogo/);
});

test('public flyer never shows lead contacts or pack download links, and buys only through real Square links', () => {
  const page = fs.readFileSync('app/new-openings/page.tsx', 'utf8') + fs.readFileSync('app/new-openings/flyer.tsx', 'utf8');
  assert.doesNotMatch(page, /\/lp\//);
  assert.doesNotMatch(page, /createServiceRoleClient|from\("chillbros_/);
  const links = page.match(/https:\/\/square\.link\/u\/\w+/g) || [];
  assert.equal(links.length, 0, 'flyer uses PAY_LINKS from buyers.ts, not its own copies');
  assert.match(page, /PAY_LINKS/);
  for (const slug of ['plumbers', 'electricians', 'hood-cleaners', 'pest-control', 'commercial-cleaning', 'signs', 'low-voltage', 'security', 'hvac-refrigeration', 'kitchen-equipment']) assert.match(page, new RegExp(`"${slug}"`), slug);
  assert.match(page, /satxnewopenings@gmail\.com/);
  assert.equal(b.packProjects('hood_cleaning'), 16);
  assert.equal(b.packProjects('kitchen_equipment'), 16);
  assert.equal(b.packProjects('plumbing'), 29);
});

// Runner: Google is a transient lookup. Load runner.ts with its I/O stubbed.
function loadRunner(pages) {
  const tx = (f) => ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const run = (f, req) => { const m = { exports: {} }; new Function('require', 'module', 'exports', tx(f))(req, m, m.exports); return m.exports; };
  const base = (id) => (id === 'server-only' ? {} : require(id));
  const mods = {
    '@/lib/chillbros/approval-notifications': { sendCompanyEmail: async () => ({ sent: true }) },
    '@/lib/chillbros/autopilot/contact-source': run('lib/chillbros/autopilot/contact-source.ts', base),
    '@/lib/chillbros/autopilot/email-extract': run('lib/chillbros/autopilot/email-extract.ts', base),
    '@/lib/chillbros/autopilot/engine': { fetchPage: async (url) => pages[url] ?? '' },
    '@/lib/chillbros/autopilot/links': { unsubscribeUrl: () => 'u' },
    '@/lib/chillbros/autopilot/store': { isSuppressed: async () => false },
    '@/lib/chillbros/google-places': run('lib/chillbros/google-places.ts', base),
    '@/lib/chillbros/revenue-discovery': { SCAN_AREAS: [{ name: 'Downtown', lat: 29.4, lon: -98.5, radiusM: 4000 }], fetchOverpass: async () => ({ elements: [] }) },
    './licenses': { fetchAllLicenses: async () => ({ buyers: [], failed: [] }) },
    './buyers': b,
  };
  return run('lib/chillbros/leadbiz/runner.ts', (id) => (id in mods ? mods[id] : base(id)));
}

test('Google buyer discovery saves only own-site data + place_id, never Google phone/address/name', async () => {
  const GOOGLE_PHONE = '(210) 555-0000';
  const GOOGLE_ADDRESS = '999 Google Listing Rd, San Antonio, TX 78201';
  const pages = {
    'https://alamocityplumbing.com': '<title>Alamo City Plumbing | Commercial Plumbers</title><a href="/contact-us">Contact</a>',
    'https://alamocityplumbing.com/contact-us': '<a href="mailto:office@alamocityplumbing.com">Email</a> <a href="tel:+1-210-555-0111">Call</a>',
  };
  const runner = loadRunner(pages);
  const requests = [];
  const realFetch = global.fetch;
  global.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    return { ok: true, json: async () => ({ places: [
      { id: 'place-1', displayName: { text: 'GOOGLE NAME Plumbing' }, nationalPhoneNumber: GOOGLE_PHONE, internationalPhoneNumber: '+1 210-555-0000', formattedAddress: GOOGLE_ADDRESS, rating: 4.9, userRatingCount: 300, regularOpeningHours: { weekdayDescriptions: ['Mon 8-5'] }, websiteUri: 'https://alamocityplumbing.com', businessStatus: 'OPERATIONAL' },
      { id: 'place-2', displayName: { text: 'No Site Plumbing' }, nationalPhoneNumber: '(210) 555-0002', formattedAddress: '2 Main St' },
      { id: 'place-3', displayName: { text: 'Closed Plumbing' }, websiteUri: 'https://closed.com', businessStatus: 'CLOSED_PERMANENTLY' },
    ] }) };
  };
  const saved = [];
  const client = { from(table) {
    if (table === 'chillbros_leadbiz_runs') return { select: async () => ({ count: 0 }) };
    return { upsert: (row) => { saved.push(row); return { select: async () => ({ data: [{ id: 1 }], error: null }) }; } };
  } };
  process.env.GOOGLE_PLACES_API_KEY = 'test-key';
  try {
    const added = await runner.discoverBuyersGoogle(client, Date.now() + 60_000);
    assert.equal(added, 1);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://places.googleapis.com/v1/places:searchText');
    const mask = requests[0].init.headers['x-goog-fieldmask'];
    assert.doesNotMatch(mask, /Phone|formattedAddress|rating|OpeningHours/i, 'never even asks Google for fields we may not keep');
    assert.equal(saved.length, 1, 'businesses with no own website (or closed) are not saved at all');
    const [row] = saved;
    assert.equal(row.business_name, 'Alamo City Plumbing');
    assert.equal(row.email, 'office@alamocityplumbing.com');
    assert.equal(row.phone, '+12105550111', 'phone is the one the business publishes on its own site');
    assert.equal(row.address, null);
    assert.equal(row.website, 'https://alamocityplumbing.com');
    assert.equal(row.source_url, 'https://www.google.com/maps/place/?q=place_id:place-1');
    assert.equal(row.status, 'ready');
    const json = JSON.stringify(saved);
    for (const leak of ['555-0000', '5550000', 'Google Listing', 'GOOGLE NAME', '"rating"', 'Mon 8-5', 'No Site', '555-0002']) assert.ok(!json.includes(leak), `leaked ${leak}`);
  } finally { global.fetch = realFetch; delete process.env.GOOGLE_PLACES_API_KEY; }
});
