/* eslint-disable @typescript-eslint/no-require-imports -- Node harness renders real components with action doubles. */
// A quote with a down payment must (1) tell the customer before they sign that the
// down payment is due at approval, and (2) keep the sold work locked (Work Now,
// scheduling, ordering parts) until that down payment is recorded.
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
    if (id === '@/lib/chillbros/service-agreement-approval') return { acceptServiceAgreementAndNotifyAction() { throw Error('Render must not mutate invoices'); } };
    if (id === 'next/navigation') return { useRouter: () => ({ refresh() {} }) };
    if (id.startsWith('@/')) {
      const base = id.slice(2);
      return load(base + (fs.existsSync(base + '.tsx') ? '.tsx' : '.ts'));
    }
    return require(id);
  }, mod, mod.exports);
  return mod.exports;
}

const gate = load('lib/chillbros/down-payment-gate.ts');
const { DocumentSignatureForm } = load('components/document-signature-form.tsx');
const quote = { downPaymentAmount: 627.5, downPaymentStatus: 'unpaid', downPaymentType: 'percent', downPaymentValue: 50, convertedInvoiceId: null };

test('an unpaid required down payment locks the sold work until it is paid', () => {
  assert.equal(gate.downPaymentBlocksWork(quote), true);
  assert.equal(gate.downPaymentBlocksWork({ ...quote, downPaymentStatus: 'paid' }), false);
  assert.equal(gate.downPaymentBlocksWork({ ...quote, downPaymentAmount: 0 }), false);
  assert.equal(gate.downPaymentBlocksWork({ ...quote, convertedInvoiceId: 'final-invoice' }), false);
  assert.match(gate.downPaymentBlockedMessage(quote), /\$627\.50 \(50%\) down payment/);
  assert.match(gate.downPaymentBlockedMessage(quote), /Payments/);
});

test('down payment label is capped at the total', () => {
  assert.equal(gate.downPaymentLabel(quote, 1255), '$627.50 (50%)');
  assert.equal(gate.downPaymentLabel({ ...quote, downPaymentType: 'fixed', downPaymentAmount: 900 }, 500), '$500.00');
});

test('customer sees the down payment before signing the estimate', () => {
  const html = renderToStaticMarkup(React.createElement(DocumentSignatureForm, { kind: 'estimate', token: 't', initialSignature: null, initialSignedAt: null, alreadyApproved: false, downPayment: '$627.50 (50%)' }));
  assert.match(html, /\$627\.50 \(50%\) down payment required/);
  assert.match(html, /before we order parts/);
  assert.match(html, /Sign &amp; continue to down payment/);
});

test('estimates without a down payment keep the plain approve button', () => {
  const html = renderToStaticMarkup(React.createElement(DocumentSignatureForm, { kind: 'estimate', token: 't', initialSignature: null, initialSignedAt: null, alreadyApproved: false }));
  assert.doesNotMatch(html, /down payment required/);
  assert.match(html, /Sign &amp; approve/);
});

test('Work Now and return-visit scheduling refuse to run while the down payment is unpaid', () => {
  const src = fs.readFileSync('lib/chillbros/job-lifecycle-actions.ts', 'utf8');
  for (const name of ['startApprovedWorkAction', 'scheduleReturnVisitAction']) {
    const start = src.indexOf(`export async function ${name}`);
    const body = src.slice(start, src.indexOf('\nexport ', start + 10));
    assert.match(body, /depositGate\(invoice\)\.blocked\) jobMessage/, `${name} must check the down payment`);
  }
});

test('customer portal pages pass the down payment into the signature form', () => {
  for (const file of ['app/portal/[token]/page.tsx', 'app/portal/[token]/document/page.tsx']) {
    assert.match(fs.readFileSync(file, 'utf8'), /downPayment=\{downPaymentRequired && !downPaymentPaid \? downPaymentLabel\(invoice, totals\.total\) : null\}/, file);
  }
});
