/* eslint-disable @typescript-eslint/no-require-imports -- Server render checks for the real billing controls. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const source = ts.transpileModule(fs.readFileSync('components/invoice-admin-controls.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(id => {
  if (id === 'next/navigation') return { useRouter: () => ({}) };
  if (id === 'next/link') return { default: props => React.createElement('a', props, props.children) };
  if (id.startsWith('@/lib/')) return {};
  return require(id);
}, mod, mod.exports);
const base = { invoiceId: 'quote', invoiceNumber: 'Q-010', status: 'awaiting_approval', issuedAt: '2026-09-29T13:42:55Z', paymentStatus: 'unpaid', taxRate: 8.25, paymentTerms: 'due_on_receipt', dueAt: null, taxExempt: false, taxExemptNote: null, hasApprovedArchive: false, hasPaidArchive: false, canManage: true, portalToken: 'token', customerPhone: null };
const render = props => renderToStaticMarkup(React.createElement(mod.exports.InvoiceAdminControls, { ...base, ...props }));
test('pending legacy quote keeps conversion visible with approval explanation and estimate override', () => {
  const html = render({});
  assert.match(html, /disabled=""[^>]*>Convert to Invoice/);
  assert.match(html, /Approval is required before conversion/);
  assert.match(html, /Billing Override \/ Document Type/);
  assert.match(html, /value="estimate"/);
});
test('approved legacy stamped quote permits conversion', () => {
  const html = render({ status: 'approved' });
  assert.match(html, />Convert to Invoice<\/button>/);
  assert.doesNotMatch(html, /disabled=""[^>]*>Convert to Invoice/);
});
test('non-owner and preserved converted quote cannot expose override actions', () => {
  const office = render({ canManage: false });
  assert.doesNotMatch(office, /Convert to Invoice|Billing Override/);
  const converted = render({ convertedInvoiceId: 'new-invoice' });
  assert.match(converted, /Open converted invoice/);
  assert.doesNotMatch(converted, /Billing Override/);
});
