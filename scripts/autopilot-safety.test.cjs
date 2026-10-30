/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, deps = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((name) => {
    if (name in deps) return deps[name];
    if (name === 'server-only') return {};
    throw new Error(`Unexpected dependency: ${name}`);
  }, mod, mod.exports);
  return mod.exports;
}
const contact = load('lib/chillbros/autopilot/contact-source.ts');
test('source refresh uses exact OSM identities and published telephone links', () => {
  assert.deepEqual(contact.osmIdentity('https://www.openstreetmap.org/way/123'), { type: 'way', id: '123' });
  assert.equal(contact.osmIdentity('https://evil.example/node/123'), null);
  assert.equal(contact.phoneFromHtml('<a href="tel:+1 (210) 555-0100">Call</a>'), '+12105550100');
  assert.equal(contact.phoneFromHtml('<div>random 2105550100</div>'), null);
});
function storeFor() {
  return load('lib/chillbros/autopilot/store.ts', {
    '@/lib/supabase/service-client': {}, './links': { normalizeContact: (v) => v.trim().toLowerCase() }, './slots': {},
  });
}
test('settings failure blocks sending; missing settings default to an approval hold', async () => {
  const store = storeFor();
  const client = (result) => ({ from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => result }) });
  await assert.rejects(store.getAutopilotSettings(client({ error: { message: 'offline' } })), /sending is blocked/);
  const settings = await store.getAutopilotSettings(client({ data: null }));
  assert.equal(settings.enabled, false);
  assert.equal(settings.outreach_approval_hold, true);
});
test('held outreach cannot reach a reservation or transport', async () => {
  const store = storeFor();
  const client = { from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { enabled: true, outreach_approval_hold: true } }) }), rpc: () => { throw new Error('must not reserve'); } };
  assert.equal(await store.reserveOutreach(client, 'cold:test:0', { lane: 'cold', channel: 'email', recipient: 'test@example.invalid' }), null);
});
test('cron workflow enriches a listing and saves contact while held, without sending', async () => {
  const updates = []; const logs = []; let transportCalls = 0;
  const row = { id: 'fixture', signal_summary: '', source_url: 'https://www.openstreetmap.org/node/123', contact_email: null, contact_phone: null };
  const client = { from: () => ({ select() { return this; }, or() { return this; }, eq() { return this; }, order() { return this; }, limit: async () => ({ data: [row] }), update(value) { updates.push(value); return { eq: async () => ({ error: null }) }; } }) };
  const extract = load('lib/chillbros/autopilot/email-extract.ts');
  const engine = load('lib/chillbros/autopilot/engine.ts', {
    '@/lib/chillbros/approval-notifications': { sendCompanyEmail: () => transportCalls++ },
    '@/lib/chillbros/notify': {}, '@/lib/supabase/service-client': { createServiceRoleClient: () => client },
    './brain': {}, './audience': {}, './contact-source': contact, './email-extract': extract,
    './inbound': {}, './replies': {}, './replies-logic': {}, './links': {},
    './slots': { centralNow: () => ({ hour: 11 }) },
    './store': { getAutopilotSettings: async () => ({ enabled: false, outreach_approval_hold: true }), logOutreach: async (_, row) => logs.push(row) }, './timing': {},
  });
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ elements: [{ type: 'node', id: 123, tags: { phone: '+12105550100', email: 'office@fixture-business.com' } }] }) });
  try {
    const run = await engine.runAutopilot();
    assert.equal(run.enriched, 1);
    assert.match(run.notes[0], /on hold/);
    assert.equal(updates[0].contact_phone, '+12105550100');
    assert.equal(updates[0].contact_email, 'office@fixture-business.com');
    assert.equal(logs[0].status, 'checked');
    assert.equal(transportCalls, 0);
  } finally { global.fetch = originalFetch; }
});
