/* eslint-disable @typescript-eslint/no-require-imports -- Node harness renders real components with action doubles. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = {};
function load(file) {
  file = path.resolve(file);
  if (cache[file]) return cache[file].exports;
  const mod = cache[file] = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', source)(id => {
    if (id === '@/lib/chillbros/job-lifecycle-actions') return { approveEstimateLifecycleAction() { throw Error('Render must not mutate invoices'); } };
    if (id.startsWith('@/')) {
      const base = id.slice(2);
      return load(base + (fs.existsSync(base + '.tsx') ? '.tsx' : '.ts'));
    }
    return require(id);
  }, mod, mod.exports);
  return mod.exports;
}
const { ClientPortalActions } = load('components/client-portal-actions.tsx');
const { DocumentPaymentMethods } = load('components/document-payment-methods.tsx');
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const invoice = { status: 'approved', issuedAt: '2026-09-17', paymentStatus: 'unpaid', invoiceNumber: 'INV-123', portalToken: 'token', signatureName: null, paymentMethod: 'zelle' };

test('approved issued invoice offers only the supplied Square checkout and exact total', () => {
  for (const html of [render(ClientPortalActions, { invoice, amountDue: 123.45 }), render(DocumentPaymentMethods, { paymentStatus: 'unpaid', invoiceNumber: 'INV-123', amountDue: 123.45 })]) {
    assert.match(html, /href="https:\/\/square.link\/u\/TezbYuSG"/);
    assert.match(html, /Enter \$123\.45 in Square/);
    assert.match(html, /INV-123/);
    assert.match(html, /until Chill Pros confirms/);
    assert.doesNotMatch(html, /Zelle|Venmo|Cash App|Other ways|stripe\/checkout|Selected manual/i);
  }
});

test('estimates, unapproved invoices and paid invoices have no checkout link', () => {
  for (const changes of [{ issuedAt: null }, { status: 'awaiting_approval' }, { status: 'draft' }, { paymentStatus: 'paid' }]) {
    assert.doesNotMatch(render(ClientPortalActions, { invoice: { ...invoice, ...changes }, amountDue: 123.45 }), /square\.link/);
  }
  assert.doesNotMatch(render(DocumentPaymentMethods, { paymentStatus: 'paid', invoiceNumber: 'INV-123', amountDue: 123.45 }), /square\.link/);
});

test('out-of-range totals cannot open the buyer-entered Square checkout', () => {
  for (const amountDue of [0, -1, 0.99, 50000.01, NaN, Infinity]) {
    assert.doesNotMatch(render(ClientPortalActions, { invoice, amountDue }), /href="https:\/\/square\.link/);
  }
  for (const amountDue of [1, 50000]) assert.match(render(ClientPortalActions, { invoice, amountDue }), /href="https:\/\/square\.link/);
});

test('retired Stripe endpoint never creates a session', async () => {
  const response = await load('app/api/payments/stripe/checkout/route.ts').POST();
  assert.equal(response.status, 410);
  assert.match((await response.json()).error, /Pay with Square/);
});
