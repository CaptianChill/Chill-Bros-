/* eslint-disable @typescript-eslint/no-require-imports -- AI Sales Assist safety checks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const read = (f) => fs.readFileSync(f, 'utf8');

function load(path, deps = {}) {
  const out = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', out)((id) => (id === 'server-only' ? {} : deps[id] ?? require(id)), mod, mod.exports);
  return mod.exports;
}
const sales = load('lib/chillbros/revenue-sales.ts');
const lead = { businessName: 'Alamo Brewing', city: 'San Antonio', score: 82, serviceLine: 'multiple', signalSummary: 'New taproom opening', signalVerified: false, sourceUrl: 'https://example.com/news', observedAt: '2026-10-01T00:00:00Z' };

function aiWith(reply) {
  let calls = 0;
  const mod = load('lib/chillbros/revenue-ai.ts', { '@/lib/chillbros/ai': { askAI: async () => { calls++; return reply; } }, '@/lib/chillbros/revenue-sales': sales });
  return { mod, calls: () => calls };
}

const good = JSON.stringify({
  fit: { score: 14, reason: 'Big kitchen and walk-ins.' },
  suggestedPlan: { tier: 'gold protection', reason: 'Depends on cold storage.' },
  whyNow: 'Opening soon.', serviceAngle: 'Backup vendor.', callOpener: 'Hi, this is [NAME] with Chill Pros.',
  discoveryQuestions: ['Who services your walk-ins?', 'Do you have PM?', 'Who handles emergencies?'],
  objectionResponses: [{ objection: 'We have a company.', response: 'Do you keep a backup?' }, { objection: 'Send info.', response: 'Happy to.' }],
  introEmail: { subject: 'Local commercial service for Alamo Brewing', body: 'Hi there,\n...\n[Your name]\nChill Pros' },
  verifiedFacts: ['INVENTED FACT'],
});

test('AI writes the copy but cannot change the verified facts or missing-info list', async () => {
  const { mod } = aiWith({ ok: true, text: `Here you go: ${good}` });
  const { card, aiUsed } = await mod.writeAiBattleCard(lead);
  const base = sales.buildSafeBattleCard(lead);
  assert.equal(aiUsed, true);
  assert.deepEqual(card.verifiedFacts, base.verifiedFacts);
  assert.deepEqual(card.missingInformation, base.missingInformation);
  assert.equal(card.technicalHandoff, base.technicalHandoff);
  assert.equal(card.fit.score, 10, 'score is clamped to 1-10');
  assert.equal(card.suggestedPlan.tier, 'Gold Protection', 'tier is normalized to a real plan');
  assert.match(card.introEmail.body, /Chill Pros/);
});

test('unusable or failed AI replies fall back to the standard battle card', async () => {
  for (const reply of [{ ok: false, error: 'AI down' }, { ok: true, text: 'not json' }, { ok: true, text: JSON.stringify({ fit: { score: 7 } }) }]) {
    const { mod } = aiWith(reply);
    const { card, aiUsed } = await mod.writeAiBattleCard(lead);
    assert.equal(aiUsed, false);
    assert.deepEqual(card, sales.buildSafeBattleCard(lead));
  }
});

test('Sales Assist only drafts: nothing sends, and Do Not Contact leads are refused', () => {
  const ai = read('lib/chillbros/revenue-ai.ts');
  assert.doesNotMatch(ai, /fetch\(|sendMail|resend|smtp|twilio/i);
  const action = read('app/revenue-radar/sales-actions.ts');
  const start = action.indexOf('export async function generateSalesBattleCard');
  const body = action.slice(start, action.indexOf('export async function', start + 10));
  assert.ok(body.indexOf('if (lead.do_not_contact) throw') < body.indexOf('writeAiBattleCard('), 'DNC is checked before any AI call');
  assert.ok(body.indexOf('requireAssignedLead(profile, lead)') < body.indexOf('writeAiBattleCard('), 'assignment is checked before any AI call');
  const ui = read('components/sales-assist-controls.tsx');
  assert.match(ui, /mailto:/);
  assert.doesNotMatch(ui, /fetch\(/);
});
