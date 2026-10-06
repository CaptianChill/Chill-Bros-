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
