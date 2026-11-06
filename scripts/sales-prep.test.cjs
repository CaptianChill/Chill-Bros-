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

// Google Maps Platform terms: Places content (phone, address, status, ...) may not be stored.
// Sales Prep may use Google only to find the business's own website; it saves what that site publishes.
function loadSalesPrep(pages) {
  const tx = (f) => ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const run = (f, req) => { const m = { exports: {} }; new Function('require', 'module', 'exports', tx(f))(req, m, m.exports); return m.exports; };
  const base = (id) => (id === 'server-only' ? {} : require(id));
  const mods = {
    '@/lib/chillbros/autopilot/engine': { fetchPage: async (url) => pages[url] ?? '' },
    '@/lib/chillbros/autopilot/contact-source': run('lib/chillbros/autopilot/contact-source.ts', base),
    '@/lib/chillbros/autopilot/email-extract': run('lib/chillbros/autopilot/email-extract.ts', base),
    '@/lib/chillbros/google-places': run('lib/chillbros/google-places.ts', base),
    '@/lib/chillbros/revenue-ai': { AI_BATTLE_CARD_PROMPT_VERSION: 'ai', writeAiBattleCard: async () => ({}) },
    '@/lib/chillbros/revenue-sales': { BATTLE_CARD_PROMPT_VERSION: 'std', buildSafeBattleCard: () => ({}) },
    '@/lib/chillbros/sales-prep-logic': p,
  };
  return run('lib/chillbros/sales-prep.ts', (id) => (id in mods ? mods[id] : base(id)));
}

async function withPlaces(places, fn) {
  const realFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, init) => { requests.push({ url: String(url), init }); return { ok: true, json: async () => ({ places }) }; };
  try { return await fn(requests); } finally { global.fetch = realFetch; }
}

const LEAD = { id: '1', business_name: 'Blanco BBQ', city: 'San Antonio', business_address: null };
const GOOGLE = { id: 'gp1', displayName: { text: 'Blanco BBQ' }, nationalPhoneNumber: '(210) 555-0000', formattedAddress: '9 Google Rd', rating: 4.8, websiteUri: 'https://blancobbq.com', businessStatus: 'OPERATIONAL' };

test('Places enrichment never saves Google\'s phone; phone and email come from the business\'s own site', async () => {
  const sp = loadSalesPrep({ 'https://blancobbq.com': '<a href="mailto:hello@blancobbq.com">x</a> <a href="tel:2105550123">call</a>' });
  await withPlaces([GOOGLE], async (requests) => {
    const update = await sp.contactUpdateFromPlaces('key', { ...LEAD });
    assert.equal(update.contact_phone, '2105550123');
    assert.equal(update.contact_email, 'hello@blancobbq.com');
    assert.deepEqual(Object.keys(update).sort(), ['contact_email', 'contact_phone', 'places_checked_at']);
    assert.doesNotMatch(requests[0].init.headers['x-goog-fieldmask'], /Phone|formattedAddress|rating/i);
  });
});

test('when the own site lists no phone, Google\'s phone is still not saved', async () => {
  const sp = loadSalesPrep({ 'https://blancobbq.com': '<p>Welcome</p>' });
  await withPlaces([GOOGLE], async () => {
    const update = await sp.contactUpdateFromPlaces('key', { ...LEAD });
    assert.deepEqual(Object.keys(update), ['places_checked_at']);
    assert.ok(!JSON.stringify(update).includes('555-0000'));
  });
  await withPlaces([{ ...GOOGLE, businessStatus: 'CLOSED_PERMANENTLY' }], async () => {
    const update = await sp.contactUpdateFromPlaces('key', { ...LEAD });
    assert.deepEqual(Object.keys(update), ['places_checked_at'], 'Google business status is not saved either');
  });
});
