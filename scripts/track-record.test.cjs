/* eslint-disable @typescript-eslint/no-require-imports -- Track Record proof-of-income math. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load() {
  const out = ts.transpileModule(fs.readFileSync('lib/chillbros/track-record.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', out)(require, mod, mod.exports);
  return mod.exports;
}

const inv = (over) => ({ id: over.id, invoiceNumber: 'I-001', customerId: 'c1', customerName: 'Ana', status: 'approved', paymentStatus: 'paid', paymentMethod: 'card', issuedAt: '2026-09-02T15:00:00Z', paidAt: '2026-09-03T15:00:00Z', createdAt: '2026-09-01T15:00:00Z', convertedInvoiceId: null, revokedAt: null, subtotal: 500, discount: 0, tax: 0, credits: 0, refunds: 0, ...over });
const asOf = new Date('2026-10-06T23:00:00Z');

test('only paid real invoices count as income; quotes, voids, drafts and converted quotes do not', () => {
  const { buildTrackRecord } = load();
  const r = buildTrackRecord([], [
    inv({ id: 'paid' }),
    inv({ id: 'quote', invoiceNumber: 'Q-004' }),
    inv({ id: 'void', status: 'void' }),
    inv({ id: 'draft', status: 'draft' }),
    inv({ id: 'converted', convertedInvoiceId: 'paid' }),
    inv({ id: 'revoked', revokedAt: '2026-09-05T00:00:00Z' }),
  ], asOf);
  assert.equal(r.invoicesPaid, 1);
  assert.equal(r.lifetimeCollected, 500);
  assert.deepEqual(r.ledger.map((row) => row.id), ['paid']);
});

test('refunds, discounts, tax and credits are applied; unpaid issued invoices are outstanding', () => {
  const { buildTrackRecord } = load();
  const r = buildTrackRecord([], [
    inv({ id: 'a', subtotal: 1000, discount: 100, tax: 74.25, credits: 50, refunds: 24.25 }),
    inv({ id: 'b', paymentStatus: 'unpaid', paidAt: null, subtotal: 300 }),
    inv({ id: 'c', paymentStatus: 'unpaid', paidAt: null, issuedAt: null, status: 'awaiting_approval', subtotal: 999 }),
  ], asOf);
  assert.equal(r.lifetimeCollected, 900);
  assert.equal(r.outstandingValue, 300);
  assert.equal(r.outstandingCount, 1);
});

test('months use San Antonio time and trailing 12 months exclude older income', () => {
  const { buildTrackRecord } = load();
  const r = buildTrackRecord([], [
    inv({ id: 'late-night', paidAt: '2026-10-01T03:30:00Z', subtotal: 200 }), // Sept 30, 10:30pm Central
    inv({ id: 'old', paidAt: '2025-03-10T15:00:00Z', subtotal: 700, customerId: 'c2' }),
  ], asOf);
  assert.equal(r.months[0].month, '2026-10');
  assert.equal(r.months.find((m) => m.month === '2026-09').collected, 200);
  assert.equal(r.months[0].collected, 0);
  assert.equal(r.trailing12Collected, 200);
  assert.equal(r.previous12Collected, 700);
  assert.equal(r.lifetimeCollected, 900);
});

test('finished calls count as completed whatever their final status; cancelled calls are ignored', () => {
  const { buildTrackRecord } = load();
  const job = (id, status) => ({ id, customerId: 'c1', status, createdAt: '2026-09-10T15:00:00Z' });
  const r = buildTrackRecord([job('1', 'paid'), job('2', 'invoice_sent'), job('3', 'work_complete'), job('4', 'completed'), job('5', 'scheduled'), job('6', 'cancelled')], [], asOf);
  assert.equal(r.callsCompleted, 4);
  assert.equal(r.callsBooked, 5);
});

test('repeat customers and average ticket', () => {
  const { buildTrackRecord } = load();
  const r = buildTrackRecord([], [inv({ id: '1', subtotal: 100 }), inv({ id: '2', subtotal: 300 }), inv({ id: '3', customerId: 'c2', subtotal: 200 })], asOf);
  assert.equal(r.customersPaying, 2);
  assert.equal(r.repeatCustomers, 1);
  assert.equal(r.averageTicket, 200);
});

test('CSV export is spreadsheet-safe', () => {
  const { buildTrackRecord, trackRecordCsv } = load();
  const csv = trackRecordCsv(buildTrackRecord([], [inv({ id: '1', customerName: '=HYPERLINK("x"), Inc' })], asOf));
  const [header, row] = csv.trim().split('\n');
  assert.match(header, /^Invoice,Customer,Issued,Paid/);
  assert.match(row, /^I-001,"'=HYPERLINK\(""x""\), Inc",2026-09-02,2026-09-03,paid,card,500\.00,500\.00$/);
});
