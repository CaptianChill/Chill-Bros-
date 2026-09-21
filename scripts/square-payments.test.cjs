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
    if (id === '@/lib/chillbros/customer-payment-actions') return { setCustomerPaymentMethodAction() { throw Error('Render must not mutate invoices'); } };
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

const configuredSettings = { zelleContact: 'owner@chillpros.example', venmoHandle: '@chill-pros', chimeHandle: '$ChillPros', checkPayableTo: 'Chill Professionals LLC', checkMailingAddress: '123 Main St, Austin, TX' };
const unconfiguredSettings = { zelleContact: '', venmoHandle: '', chimeHandle: '', checkPayableTo: '', checkMailingAddress: '' };
const invoice = { status: 'approved', issuedAt: '2026-09-17', paymentStatus: 'unpaid', invoiceNumber: 'INV-123', portalToken: 'token', signatureName: null, paymentMethod: null };

test('approved issued invoice defaults to the card tab, offers Square, and lists every payment tab', () => {
  for (const html of [
    render(ClientPortalActions, { invoice, amountDue: 123.45, paymentSettings: configuredSettings }),
    render(DocumentPaymentMethods, { paymentStatus: 'unpaid', invoiceNumber: 'INV-123', amountDue: 123.45, token: 'token', initialMethod: null, settings: configuredSettings }),
  ]) {
    assert.match(html, /href="https:\/\/square.link\/u\/TezbYuSG"/);
    assert.match(html, /Enter \$123\.45 in Square/);
    assert.match(html, /INV-123/);
    assert.match(html, />Zelle</);
    assert.match(html, />Venmo</);
    assert.match(html, />Chime</);
    assert.match(html, />Check</);
    assert.match(html, />Cash</);
    assert.doesNotMatch(html, /stripe\/checkout/i);
  }
});

test('unconfigured manual methods tell the customer to contact the office instead of offering a broken option', () => {
  const zelleActive = { ...invoice, paymentMethod: 'zelle' };
  const configured = render(ClientPortalActions, { invoice: zelleActive, amountDue: 123.45, paymentSettings: configuredSettings });
  assert.match(configured, /Send \$123\.45 via Zelle to owner@chillpros\.example/);
  assert.match(configured, /Marked as paying by Zelle/);

  const unconfigured = render(ClientPortalActions, { invoice: zelleActive, amountDue: 123.45, paymentSettings: unconfiguredSettings });
  assert.match(unconfigured, /Zelle isn(?:&#x27;|')t set up yet/);
  assert.doesNotMatch(unconfigured, /paying by Zelle/);
});

test('check tab shows payable-to and mailing address when configured', () => {
  const checkActive = { ...invoice, paymentMethod: 'check' };
  const html = render(ClientPortalActions, { invoice: checkActive, amountDue: 123.45, paymentSettings: configuredSettings });
  assert.match(html, /Make checks payable to Chill Professionals LLC/);
  assert.match(html, /123 Main St, Austin, TX/);
});

test('estimates, unapproved invoices and paid invoices have no checkout link', () => {
  for (const changes of [{ issuedAt: null }, { status: 'awaiting_approval' }, { status: 'draft' }, { paymentStatus: 'paid' }]) {
    assert.doesNotMatch(render(ClientPortalActions, { invoice: { ...invoice, ...changes }, amountDue: 123.45, paymentSettings: configuredSettings }), /square\.link/);
  }
  const paidHtml = render(DocumentPaymentMethods, { paymentStatus: 'paid', invoiceNumber: 'INV-123', amountDue: 123.45, token: 'token', initialMethod: null, settings: configuredSettings });
  assert.doesNotMatch(paidHtml, /square\.link/);
  assert.match(paidHtml, /Payment received/);
});

test('out-of-range totals cannot open the buyer-entered Square checkout', () => {
  for (const amountDue of [0, -1, 0.99, 50000.01, NaN, Infinity]) {
    assert.doesNotMatch(render(ClientPortalActions, { invoice, amountDue, paymentSettings: configuredSettings }), /href="https:\/\/square\.link/);
  }
  for (const amountDue of [1, 50000]) assert.match(render(ClientPortalActions, { invoice, amountDue, paymentSettings: configuredSettings }), /href="https:\/\/square\.link/);
});

test('retired Stripe endpoint never creates a session', async () => {
  const response = await load('app/api/payments/stripe/checkout/route.ts').POST();
  assert.equal(response.status, 410);
  assert.match((await response.json()).error, /Pay with Square/);
});
