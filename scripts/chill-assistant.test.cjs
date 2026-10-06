/* eslint-disable @typescript-eslint/no-require-imports -- Chill voice assistant wiring checks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (f) => fs.readFileSync(f, 'utf8');

test('all six mascot poses ship with the app', () => {
  for (const p of ['idle', 'greeting', 'listening', 'thinking', 'talking', 'success']) assert.ok(fs.existsSync(`public/chill-pros-mascot/${p}.webp`), p);
});

test('voice routes require a signed-in staff member and use the BOODA cedar voice, professionally', () => {
  for (const f of ['app/api/voice/speak/route.ts', 'app/api/voice/transcribe/route.ts', 'app/api/voice/ask/route.ts']) {
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
  const action = read('lib/chillbros/chill-assistant.ts');
  assert.match(action, /^"use server";/);
  assert.match(action, /getCurrentStaffProfile\(\)[\s\S]*if \(!profile\) return[\s\S]*answerChill\(/);
  const src = read('lib/chillbros/chill-brain.ts');
  assert.match(src, /^import "server-only";/);
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
  assert.match(read('lib/chillbros/chill-brain.ts'), /under 60 words/);
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
  new Function('require', 'module', 'exports', 'process', out)((id) => (id === 'server-only' ? {} : id === '@/lib/chillbros/voice-tags' ? loadTags() : require(id)), mod, mod.exports, process);
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

test('spoken questions take one trip: snapshot starts before transcription finishes', () => {
  const route = read('app/api/voice/ask/route.ts');
  assert.ok(route.indexOf('snapshotFor(profile)') < route.indexOf('await transcribeAudio('), 'snapshot is started first');
  assert.match(route, /answerChill\(profile, heard\.text, history, snapshot\)/);
  assert.match(read('components/chill-assistant.tsx'), /fetch\("\/api\/voice\/ask"/);
});

function loadTags() {
  const ts = require('typescript');
  const out = ts.transpileModule(read('lib/chillbros/voice-tags.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', out)(require, mod, mod.exports);
  return mod.exports;
}

test('emotion tags drive v3 delivery and are hidden everywhere else', () => {
  const t = loadTags();
  assert.equal(t.stripVoiceTags('[excited] Whoa! You have [chuckles] two calls.'), 'Whoa! You have two calls.');
  assert.equal(t.keepKnownVoiceTags('[Excited] Hi [dances] there.'), '[excited] Hi there.');
  assert.equal(t.firstVoiceTag('[dances] [sighs] Uh-oh.'), 'sighs');
  assert.equal(t.firstVoiceTag('No tags.'), null);
  const voice = read('lib/chillbros/voice.ts');
  assert.match(voice, /text: keepKnownVoiceTags\(text\), voice_id/);
  assert.match(voice, /text: stripVoiceTags\(text\), model_id/);
  assert.match(read('app/api/voice/speak/route.ts'), /input: stripVoiceTags\(text\)/);
});

function loadParts(fakeResearch, fakeAsk) {
  const ts = require('typescript');
  const out = ts.transpileModule(read('lib/chillbros/chill-parts.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  const deps = { 'server-only': {}, '@/lib/chillbros/ai': { askAI: fakeAsk }, '@/lib/chillbros/parts-research': { researchParts: fakeResearch } };
  new Function('require', 'module', 'exports', out)((id) => deps[id] ?? require(id), mod, mod.exports);
  return mod.exports;
}

test('Chilly Bro looks up OEM parts only for real parts requests, with sourced links', async () => {
  let researched = null;
  const research = { summary: 'Found it', serialCheck: 'Serial not confirmed', parts: [{ name: 'Condenser fan motor', partNumber: 'HC39GE237', evidence: 'Parts list', url: 'https://oem.example/list.pdf' }], manuals: [], contacts: [], nextSteps: [] };
  const p = loadParts(async (input, opts) => { researched = { input, opts }; return research; }, async () => ({ ok: true, text: '{"lookup":true,"brand":"Carrier","model":"48TCED08","serial":"1218G20345","part":"condenser fan motor","manual":false}' }));
  assert.equal(p.mightBePartsLookup('Who owes us money?'), false);
  assert.equal(p.mightBePartsLookup('What fan motor fits a Carrier 48TCED08?'), true);
  assert.equal(await p.chillPartsLookup('How is my day looking?', []), null);
  const hit = await p.chillPartsLookup('Need the condenser fan motor for a Carrier 48TCED08 serial 1218G20345', []);
  assert.deepEqual(researched.opts, { quick: true });
  assert.equal(researched.input.model, '48TCED08'); assert.equal(researched.input.mode, 'parts');
  assert.match(hit.context, /HC39GE237/); assert.match(hit.context, /Say only part numbers that appear here/);
  assert.deepEqual(hit.links, [{ label: 'Condenser fan motor · HC39GE237', url: 'https://oem.example/list.pdf' }]);
  const noModel = loadParts(async () => { throw new Error('should not search'); }, async () => ({ ok: true, text: '{"lookup":true,"brand":"Carrier","model":"","serial":"","part":"fan motor","manual":false}' }));
  assert.match((await noModel.chillPartsLookup('Need a fan motor part for unit 4B12', [])).context, /did not give a model number/);
  const failing = loadParts(async () => { throw new Error('timeout'); }, async () => ({ ok: true, text: '{"lookup":true,"brand":"Hoshizaki","model":"KM-515MAJ","serial":"","part":"","manual":true}' }));
  const failed = await failing.chillPartsLookup('Find the parts manual for Hoshizaki KM-515MAJ', []);
  assert.match(failed.context, /Do not guess part numbers/); assert.equal(failed.links.length, 0);
  assert.match(read('lib/chillbros/parts-research.ts'), /max_tool_calls: quick \? 5 : 10/);
  assert.match(read('app/api/voice/ask/route.ts'), /maxDuration = 120/);
});
