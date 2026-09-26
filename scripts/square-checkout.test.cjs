/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness transpiles server modules with dependency doubles. */
/* Square Checkout API: signature check and payment recording.
 * Run: node --test scripts/square-checkout.test.cjs
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');

function harness({ invoice, order }) {
  const tables = { chillbros_invoices: [{ id: 'inv', payment_status: 'unpaid', down_payment_status: 'unpaid' }], chillbros_workflow_events: [], chillbros_receipts: [] };
  const db = { from(table) {
    const filters = []; let op = 'read', values, single = false;
    const q = {
      select() { return q; }, eq(k, v) { filters.push(r => r[k] === v); return q; }, neq(k, v) { filters.push(r => r[k] !== v); return q; },
      update(v) { op = 'update'; values = v; return q; }, insert(v) { op = 'insert'; values = v; return q; }, maybeSingle() { single = true; return q; },
      then(res, rej) { const rows = tables[table] ??= []; let m = rows.filter(r => filters.every(f => f(r)));
        if (op === 'insert') { const row = { id: String(rows.length + 1), ...values }; rows.push(row); m = [row]; }
        if (op === 'update') m.forEach(r => Object.assign(r, values));
        return Promise.resolve({ data: single ? m[0] ?? null : m, error: null }).then(res, rej); },
    }; return q; } };
  const totals = inv => ({ total: inv.total, amountDueNow: inv.total });
  const mocks = {
    'server-only': {},
    '@/lib/supabase/service-client': { createServiceRoleClient: () => db },
    '@/lib/chillbros/billing-receipts': { createReceiptForPaidInvoice: async () => { tables.chillbros_receipts.push({ id: 'r1' }); return { id: 'r1' }; } },
    '@/lib/chillbros/invoice-v2': { getInvoiceV2ById: async () => invoice, getInvoiceV2ByToken: async () => invoice, invoiceTotals: totals },
  };
  process.env.SQUARE_ACCESS_TOKEN = 'test'; process.env.SQUARE_LOCATION_ID = 'loc'; process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = 'sig-key';
  global.fetch = async () => ({ ok: true, json: async () => ({ order }) });
  const file = path.join(ROOT, 'lib/chillbros/square-checkout.ts');
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', out)(id => mocks[id] ?? require(id), mod, mod.exports);
  return { tables, lib: mod.exports };
}

const invoice = { id: 'inv', status: 'approved', jobId: 'job', invoiceNumber: 'I-005', customerName: 'Nordstrom', portalToken: 't', total: 869, downPaymentAmount: 0 };
const order = { reference_id: 'inv', metadata: { invoice_id: 'inv', kind: 'invoice' } };

test('Square signature: valid passes, tampered body or wrong key fails', () => {
  const { lib } = harness({ invoice, order });
  const url = 'https://chill-bros.vercel.app/api/payments/square/webhook';
  const body = '{"type":"payment.updated"}';
  const sig = crypto.createHmac('sha256', 'sig-key').update(url + body).digest('base64');
  assert.equal(lib.verifySquareSignature(body, sig, url), true);
  assert.equal(lib.verifySquareSignature(body + ' ', sig, url), false);
  assert.equal(lib.verifySquareSignature(body, null, url), false);
});

test('completed Square payment for the exact amount marks the invoice paid once', async () => {
  const { lib, tables } = harness({ invoice, order });
  const payment = { id: 'pay1', status: 'COMPLETED', order_id: 'ord1', amount_money: { amount: 86900 } };
  const first = await lib.recordSquarePayment(payment);
  assert.equal(first.recorded, true);
  assert.equal(tables.chillbros_invoices[0].payment_status, 'paid');
  assert.equal(tables.chillbros_invoices[0].payment_method, 'card');
  assert.equal(tables.chillbros_receipts.length, 1);
  const second = await lib.recordSquarePayment(payment);
  assert.equal(second.recorded, false, 'a repeated webhook does not record twice');
  assert.equal(tables.chillbros_receipts.length, 1);
});

test('amount mismatch is flagged for review, not marked paid', async () => {
  const { lib, tables } = harness({ invoice, order });
  const result = await lib.recordSquarePayment({ id: 'pay2', status: 'COMPLETED', order_id: 'ord1', amount_money: { amount: 50000 } });
  assert.equal(result.recorded, false);
  assert.equal(tables.chillbros_invoices[0].payment_status, 'unpaid');
  assert.ok(tables.chillbros_workflow_events.some(e => e.stage === 'square_payment_review'));
});

test('pending (not completed) payments are ignored', async () => {
  const { lib, tables } = harness({ invoice, order });
  const result = await lib.recordSquarePayment({ id: 'pay3', status: 'APPROVED', order_id: 'ord1', amount_money: { amount: 86900 } });
  assert.equal(result.recorded, false);
  assert.equal(tables.chillbros_invoices[0].payment_status, 'unpaid');
});

test('down payment checkout marks only the down payment paid', async () => {
  const dpInvoice = { ...invoice, total: 1000, downPaymentAmount: 250 };
  const { lib, tables } = harness({ invoice: dpInvoice, order: { reference_id: 'inv', metadata: { invoice_id: 'inv', kind: 'down_payment' } } });
  const result = await lib.recordSquarePayment({ id: 'pay4', status: 'COMPLETED', order_id: 'ord2', amount_money: { amount: 25000 } });
  assert.equal(result.recorded, true);
  assert.equal(tables.chillbros_invoices[0].down_payment_status, 'paid');
  assert.equal(tables.chillbros_invoices[0].payment_status, 'unpaid');
});
