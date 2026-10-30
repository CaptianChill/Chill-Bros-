/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { EventEmitter } = require('node:events');
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
    './inbound': {}, './replies': { runBounceDesk: async () => 0 }, './replies-logic': {}, './links': {},
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

test('permanent bounces require authenticated sender, failed recipient, and failure status', () => {
  const { permanentBounceRecipients } = load('lib/chillbros/autopilot/bounce-logic.ts');
  const message = { from: 'mailer-daemon@googlemail.com', subject: 'Delivery Status Notification (Failure)', text: '550 5.1.1 mailbox does not exist', headers: { 'authentication-results': 'mx.google.com; dkim=pass header.i=@googlemail.com; dmarc=pass', 'x-failed-recipients': 'office@fixture-business.com' } };
  assert.deepEqual(permanentBounceRecipients(message), ['office@fixture-business.com']);
  assert.deepEqual(permanentBounceRecipients({ ...message, subject: 'Delivery Status Notification (Delay)' }), []);
  assert.deepEqual(permanentBounceRecipients({ ...message, from: 'someone@fixture-business.com' }), []);
  assert.deepEqual(permanentBounceRecipients({ ...message, headers: { ...message.headers, 'authentication-results': 'dkim=fail' } }), []);
});

test('accepted SMTP DATA stays sent when QUIT disconnects; rejected DATA is a failure', async () => {
  const originalUser = process.env.GMAIL_SMTP_USER;
  const originalPassword = process.env.GMAIL_SMTP_APP_PASSWORD;
  process.env.GMAIL_SMTP_USER = 'fixture@example.invalid';
  process.env.GMAIL_SMTP_APP_PASSWORD = 'fixture-password';
  try {
    for (const acceptData of [true, false]) {
      const socket = new EventEmitter(); let write = 0;
      socket.destroy = () => {};
      const responses = ['250 OK','334 user','334 password','235 OK','250 OK','250 OK','354 DATA',acceptData ? '250 accepted' : '550 rejected'];
      socket.write = () => { const response = responses[write++]; queueMicrotask(() => response ? socket.emit('data',Buffer.from(response + '\r\n')) : socket.emit('error',new Error('QUIT disconnected'))); };
      const mail = load('lib/chillbros/approval-notifications.ts', {
        'node:tls': { connect: () => { queueMicrotask(() => { socket.emit('secureConnect'); setImmediate(() => socket.emit('data',Buffer.from('220 ready\r\n'))); }); return socket; } },
        '@/lib/chillbros/notify': {}, '@/lib/supabase/service-client': {},
      });
      if (acceptData) assert.equal((await mail.sendCompanyEmail('recipient@example.invalid','Fixture','Fixture')).status,'sent');
      else await assert.rejects(mail.sendCompanyEmail('recipient@example.invalid','Fixture','Fixture'),/not accepted/);
    }
  } finally {
    if (originalUser === undefined) delete process.env.GMAIL_SMTP_USER; else process.env.GMAIL_SMTP_USER = originalUser;
    if (originalPassword === undefined) delete process.env.GMAIL_SMTP_APP_PASSWORD; else process.env.GMAIL_SMTP_APP_PASSWORD = originalPassword;
  }
});
