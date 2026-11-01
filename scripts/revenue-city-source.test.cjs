/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('lib/chillbros/revenue-city-source.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('require', 'module', 'exports', code)(id => id === 'server-only' ? {} : require(id), mod, mod.exports);
const { latestCityReport, cityEstablishments, discoverCityEstablishments } = mod.exports;
const now = new Date('2026-10-31T12:00:00Z');
const path = '/files/assets/public/v/1/samhd/documents/health-data-statistics/fe/2026/1018-1024.xlsx';
test('city reports reject off-site, stale and future sources', () => {
  const html = `<a href="https://evil.example${path}">bad</a><a href="${path}">good</a>`;
  assert.equal(latestCityReport(html, now), `https://www.sa.gov${path}`);
  assert.equal(latestCityReport(`<a href="${path.replace('1018', '0101')}">old</a>`, now), null);
  assert.equal(latestCityReport(`<a href="${path.replace('1018', '1201')}">future</a>`, now), null);
});
test('city parser fails closed on schema changes and excludes nonlocal or stale records', () => {
  assert.throws(() => cityEstablishments([['Wrong columns']], 'source', now), /schema changed/);
  const header = ['ESTABLISHMENT NAME', 'ESTABLISHMENT ADDRESS', 'INSPECTION DATE'];
  const records = cityEstablishments([header,
    ['Local kitchen', '123 Main St San Antonio, TX 78201', new Date('2026-10-18')],
    ['Other city', '123 Main St Austin, TX', new Date('2026-10-18')],
    ['Old kitchen', '123 Main St San Antonio, TX', new Date('2025-10-18')],
  ], 'https://www.sa.gov/report.xlsx', now);
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceUrl, 'https://www.sa.gov/report.xlsx#row-2');
});
test('city discovery parses a real XLSX response using the single-sheet API', async () => {
  const original = global.fetch;
  const bytes = fs.readFileSync('scripts/fixtures/city-inspections.xlsx');
  let requests = 0;
  global.fetch = async () => ++requests === 1
    ? new Response(`<a href="${path}">report</a>`)
    : new Response(bytes);
  try {
    const rows = await discoverCityEstablishments(Date.now() + 30000);
    assert.ok(rows.length > 200);
    assert.ok(rows.every(row => /San Antonio/i.test(row.address)));
  } finally { global.fetch = original; }
});

