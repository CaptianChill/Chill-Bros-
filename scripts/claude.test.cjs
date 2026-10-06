/* eslint-disable @typescript-eslint/no-require-imports -- Claude client + wiring checks with a fake Anthropic API. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadClaude() {
  const out = ts.transpileModule(fs.readFileSync('lib/chillbros/claude.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'process', out)((id) => (id === 'server-only' ? {} : require(id)), mod, mod.exports, process);
  return mod.exports;
}

test('askClaude sends a valid Messages API request and returns the text', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'Check the capacitor first.' }] }) }; };
  try {
    const { askClaude } = loadClaude();
    const r = await askClaude({ system: 'sys', messages: [{ role: 'user', content: 'hi' }] });
    assert.deepEqual(r, { ok: true, text: 'Check the capacitor first.' });
    assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
    assert.equal(calls[0].init.headers['x-api-key'], 'test-key');
    assert.equal(calls[0].init.headers['anthropic-version'], '2023-06-01');
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.system, 'sys');
    assert.ok(body.model && body.max_tokens > 0);
    assert.deepEqual(body.messages, [{ role: 'user', content: 'hi' }]);
  } finally { global.fetch = realFetch; delete process.env.ANTHROPIC_API_KEY; }
});

test('askClaude explains API errors and a missing key instead of throwing', async () => {
  const realFetch = global.fetch;
  try {
    const { askClaude } = loadClaude();
    const missing = await askClaude({ system: 's', messages: [{ role: 'user', content: 'q' }] });
    assert.equal(missing.ok, false); assert.match(missing.error, /ANTHROPIC_API_KEY/);
    process.env.ANTHROPIC_API_KEY = 'k';
    global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid x-api-key' } }) });
    const bad = await askClaude({ system: 's', messages: [{ role: 'user', content: 'q' }] });
    assert.deepEqual(bad, { ok: false, error: 'Claude: invalid x-api-key' });
  } finally { global.fetch = realFetch; delete process.env.ANTHROPIC_API_KEY; }
});

test('Tech Assist uses Claude when connected, else the existing OpenAI key', () => {
  const ai = fs.readFileSync('lib/chillbros/ai.ts', 'utf8');
  assert.ok(ai.indexOf('claudeConfigured()') < ai.indexOf('createOpenAI({ apiKey })'));
  assert.match(fs.readFileSync('lib/chillbros/tech-assist-ai.ts', 'utf8'), /await askAI\(/);
});

test('Tech Assist chat is on the job page and techs only reach their own jobs', () => {
  assert.match(fs.readFileSync('app/tech-assist/[id]/page.tsx', 'utf8'), /<TechAssistChat jobId=\{j\.id\}\/>/);
  const action = fs.readFileSync('lib/chillbros/tech-assist-ai.ts', 'utf8');
  assert.match(action, /^"use server";/);
  assert.match(action, /profile\.role === "technician"[\s\S]*assigned_tech_id !== profile\.id/);
  assert.match(action, /Never invent model numbers/);
});

test('quote text assist prefers Claude and falls back to OpenAI', () => {
  const src = fs.readFileSync('lib/chillbros/text-assist-actions.ts', 'utf8');
  assert.ok(src.indexOf('claudeConfigured()') < src.indexOf('createOpenAI({ apiKey })'));
});
