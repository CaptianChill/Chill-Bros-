/* eslint-disable @typescript-eslint/no-require-imports -- Chill voice assistant wiring checks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (f) => fs.readFileSync(f, 'utf8');

test('all six mascot poses ship with the app', () => {
  for (const p of ['idle', 'greeting', 'listening', 'thinking', 'talking', 'success']) assert.ok(fs.existsSync(`public/chill-pros-mascot/${p}.webp`), p);
});

test('voice routes require a signed-in staff member and use the BOODA cedar voice, professionally', () => {
  for (const f of ['app/api/voice/speak/route.ts', 'app/api/voice/transcribe/route.ts']) {
    const src = read(f);
    assert.match(src, /getCurrentStaffProfile\(\)/, f);
    assert.match(src, /if \(!profile\) return/, f);
    assert.match(src, /sameOrigin\(request\)/, f);
  }
  const voice = read('lib/chillbros/voice.ts');
  assert.match(voice, /CHILL_VOICE = "cedar"/);
  assert.match(voice, /no slang/i);
});

test('Chill answers from a role-scoped live snapshot and never takes actions', () => {
  const src = read('lib/chillbros/chill-assistant.ts');
  assert.match(src, /^"use server";/);
  assert.match(src, /profile\.role === "technician"[\s\S]*getAssignedFieldJobsForTechnician/);
  assert.match(src, /only discuss their own jobs/);
  assert.match(src, /Never invent customers, amounts/);
  assert.match(src, /You cannot change anything in the app/);
  assert.match(src, /await askAI\(/);
});

test('poses follow real state: listening while recording, talking only during voice playback', () => {
  const src = read('components/chill-assistant.tsx');
  assert.match(src, /setRecording\(true\);\s*setPose\("listening"\)/);
  assert.match(src, /setPose\("thinking"\)/);
  assert.match(src, /addEventListener\("play", \(\) => \{ if \(isVoice\(\)\) setPose\("talking"\)/);
  assert.match(read('components/app-shell.tsx'), /<ChillAssistant firstName=\{user\.firstName\} \/>/);
});

test('custom ElevenLabs voice (v3 by default) with OpenAI cedar as backup', () => {
  const voice = read('lib/chillbros/voice.ts');
  assert.match(voice, /CHILL_ELEVEN_MODEL \|\| "eleven_v3"/);
  assert.match(voice, /BOODA_ELEVEN_VOICE_ID/);
  assert.match(voice, /text-to-dialogue\/stream/);
  const route = read('app/api/voice/speak/route.ts');
  assert.ok(route.indexOf('elevenSpeech(') < route.indexOf('api.openai.com/v1/audio/speech'), 'ElevenLabs is tried before the backup voice');
});

test('answers are short and start speaking after the first sentence', () => {
  assert.match(read('lib/chillbros/chill-assistant.ts'), /under 60 words/);
  const ts = require('typescript');
  const out = ts.transpileModule(read('components/chill-assistant.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const m = out.match(/function splitForSpeech[\s\S]*?\n}/);
  const splitForSpeech = new Function(`${m[0]}; return splitForSpeech;`)();
  assert.deepEqual(splitForSpeech('You have three unassigned calls today. Alamo Brewing has waited longest.'), ['You have three unassigned calls today.', 'Alamo Brewing has waited longest.']);
  assert.deepEqual(splitForSpeech('Yes.'), ['Yes.']);
});

function loadVoice() {
  const ts = require('typescript');
  const out = ts.transpileModule(read('lib/chillbros/voice.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'process', out)((id) => (id === 'server-only' ? {} : require(id)), mod, mod.exports, process);
  return mod.exports;
}

test('voice falls back from v3 to the same voice on Turbo, and explains failures', async () => {
  const realFetch = global.fetch;
  const env = { ...process.env };
  try {
    delete process.env.ELEVEN_API_KEY; delete process.env.BOODA_ELEVEN_VOICE_ID;
    assert.match((await loadVoice().elevenSpeech('Hi')).reason, /settings not found/);
    process.env.ELEVEN_API_KEY = 'k'; process.env.BOODA_ELEVEN_VOICE_ID = 'v';
    const calls = [];
    global.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return url.includes('dialogue') ? { ok: false, status: 400, body: null, text: async () => '{"detail":{"message":"voice not supported by v3"}}' } : { ok: true, status: 200, body: 'audio' }; };
    const r = await loadVoice().elevenSpeech('Hi');
    assert.equal(r.ok, true); assert.equal(r.model, 'eleven_turbo_v2_5');
    assert.match(calls[0].url, /text-to-dialogue\/stream/); assert.match(calls[1].url, /text-to-speech\/v\/stream/);
    global.fetch = async () => ({ ok: false, status: 401, body: null, text: async () => '{"detail":{"message":"Invalid API key"}}' });
    const bad = await loadVoice().elevenSpeech('Hi');
    assert.equal(bad.ok, false); assert.match(bad.reason, /401 Invalid API key/); assert.doesNotMatch(bad.reason, /turbo/);
  } finally { global.fetch = realFetch; process.env = env; }
});
