/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness. */
// Reply desk pure logic: which emails get answered, quoted-history trimming, verdict parsing.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');

const src = ts.transpileModule(fs.readFileSync('lib/chillbros/autopilot/replies-logic.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', src)(require, mod, mod.exports);
const r = mod.exports;

test('bounces, auto-responders and no-reply senders are never answered', () => {
  const human = { from: 'owner@tacos.com', subject: 'Re: Equipment service for Tacos', headers: {} };
  assert.equal(r.isAutomatedMessage(human), false);
  assert.equal(r.isAutomatedMessage({ ...human, from: 'mailer-daemon@googlemail.com' }), true);
  assert.equal(r.isAutomatedMessage({ ...human, from: 'noreply@tacos.com' }), true);
  assert.equal(r.isAutomatedMessage({ ...human, headers: { 'auto-submitted': 'auto-replied' } }), true);
  assert.equal(r.isAutomatedMessage({ ...human, headers: { 'auto-submitted': 'no' } }), false);
  assert.equal(r.isAutomatedMessage({ ...human, headers: { precedence: 'bulk' } }), true);
  assert.equal(r.isAutomatedMessage({ ...human, subject: 'Automatic reply: Equipment service' }), true);
  assert.equal(r.isAutomatedMessage({ ...human, subject: 'Out of Office' }), true);
});

test('only the new part of a reply reaches the brain', () => {
  const text = 'Yes, our walk-in is running warm. Can you come Thursday?\n\nMaria\n\nOn Mon, Oct 26, 2026 at 2:05 PM Chill Pros <chillprostx@gmail.com> wrote:\n> Hello Tacos team,\n> Chill Pros is a San Antonio service company';
  assert.equal(r.stripQuoted(text), 'Yes, our walk-in is running warm. Can you come Thursday?\n\nMaria');
  assert.equal(r.stripQuoted('Not interested.\n-----Original Message-----\nFrom: Chill Pros'), 'Not interested.');
  assert.equal(r.stripQuoted('> quoted only'), '');
});

test('reply subjects thread under the original', () => {
  assert.equal(r.replySubject('Equipment service for Tacos'), 'Re: Equipment service for Tacos');
  assert.equal(r.replySubject('RE: Equipment service'), 'RE: Equipment service');
  assert.equal(r.replySubject(null), 'Re: Chill Pros');
});

test('brain verdicts are parsed strictly; anything malformed goes to the owner', () => {
  const v = r.parseReplyVerdict('Sure.\n{"intent":"booking_request","hot":true,"summary":"Maria at Tacos: walk-in warm, wants Thursday","reply":"Maria, thanks..."}');
  assert.deepEqual(v, { intent: 'booking_request', hot: true, summary: 'Maria at Tacos: walk-in warm, wants Thursday', reply: 'Maria, thanks...' });
  assert.equal(r.parseReplyVerdict('{"intent":"buy_now","hot":true}'), null);
  assert.equal(r.parseReplyVerdict('no json here'), null);
  assert.equal(r.parseReplyVerdict('{"intent":"question","hot":"yes","reply":"x"}').hot, false, 'hot must be a real true');
});

test('opt-outs and out-of-office never get a written answer; replies only in daytime', () => {
  assert.equal(r.intentGetsReply('unsubscribe'), false);
  assert.equal(r.intentGetsReply('not_interested'), false);
  assert.equal(r.intentGetsReply('out_of_office'), false);
  assert.equal(r.intentGetsReply('question'), true);
  assert.equal(r.intentGetsReply('wrong_contact'), true);
  assert.equal(r.replyHoursOpen(6), false);
  assert.equal(r.replyHoursOpen(7), true);
  assert.equal(r.replyHoursOpen(20), true);
  assert.equal(r.replyHoursOpen(21), false);
});
