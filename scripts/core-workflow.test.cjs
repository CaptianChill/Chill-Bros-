/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness transpiles server actions with dependency doubles. */
/* Regression tests exercise the real server actions with an in-memory Data API double.
 * Run: node --test scripts/core-workflow.test.cjs
 * Live auth, SMTP delivery, and database policies still require preview verification.
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function harness(seed = {}, delivery = { status: 'sent', recipient: 'test@example.com' }, role = 'manager') {
  const tables = structuredClone(seed);
  const calls = [];
  const profile = { id: 'tech', role, email: 'owner@example.com' };
  const db = { from(table) {
    const filters = []; let operation = 'read', values, single = false;
    const query = {
      select() { return query; },
      eq(k, v) { filters.push(r => r[k] === v); return query; },
      neq(k, v) { filters.push(r => r[k] !== v); return query; },
      is(k, v) { filters.push(r => (r[k] ?? null) === v); return query; },
      in(k, v) { filters.push(r => v.includes(r[k])); return query; },
      gte(k, v) { filters.push(r => r[k] >= v); return query; },
      not(k, op, v) { assert.equal(op, 'is'); filters.push(r => r[k] !== v); return query; },
      limit() { return query; },
      update(input) { operation = 'update'; values = input; return query; },
      insert(input) { operation = 'insert'; values = input; return query; },
      maybeSingle() { single = true; return query; },
      single() { single = true; return query; },
      then(resolve, reject) {
        try {
          const rows = tables[table] ??= [];
          let matching = rows.filter(r => filters.every(f => f(r)));
          if (operation === 'insert') {
            if (values.id && rows.some(r => r.id === values.id)) return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } }).then(resolve, reject);
            const row = { id: String(rows.length + 1), created_at: new Date().toISOString(), ...values };
            rows.push(row); matching = [row];
          }
          if (operation === 'update') matching.forEach(r => Object.assign(r, values));
          calls.push({ table, operation, values });
          return Promise.resolve({ data: structuredClone(single ? matching[0] ?? null : matching), error: null }).then(resolve, reject);
        } catch (error) { return Promise.reject(error).then(resolve, reject); }
      },
    };
    return query;
  } };
  const mocks = {
    'server-only': {},
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect(location) { throw Object.assign(new Error('redirect'), { location }); } },
    '@/lib/supabase/auth-server': { getCurrentStaffProfile: async () => profile },
    '@/lib/supabase/service-client': { createServiceRoleClient: () => db },
    '@/lib/chillbros/assignment-notifications': {
      verifyTechnicianAssignment: async () => ({ ok: true }),
      sendTechnicianAssignmentEmail: async () => ({ sent: delivery.status === 'sent', ...delivery }),
    },
    '@/lib/chillbros/billing-delivery': { sendBillingDeliveryRecorded: async () => delivery },
    '@/lib/chillbros/approval-notifications': { sendApprovalNotification: async () => {}, sendCompanyEmail: async () => ({ sent: delivery.status === 'sent', ...delivery }) },
    '@/lib/chillbros/knowledge-cases': { captureCompletedJobKnowledge: async () => {} },
    '@/lib/chillbros/billing-receipts': { createReceiptForPaidInvoice: async () => {} },
    '@/lib/auth/server': { auth: {} },
    '@/lib/chillbros/invoice-pdf': { archiveInvoicePdf: async () => {} },
    '@/lib/chillbros/invoice-v2': {
      getInvoiceV2ById: async id => {
        const row = tables.chillbros_invoices?.find(r => r.id === id && !r.revoked_at && r.status !== 'void');
        return row ? { ...row, customerId: row.customer_id, jobId: row.job_id, paymentStatus: row.payment_status, portalToken: row.portal_token, reminderCount: 0 } : null;
      },
    },
  };
  const cache = {};
  function load(file) {
    file = path.resolve(file);
    if (cache[file]) return cache[file].exports;
    const loadedModule = cache[file] = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', source)(id => {
      if (mocks[id]) return mocks[id];
      if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
      if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'));
      return require(id);
    }, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return { tables, calls, load };
}

const active = ['new', 'needs_scheduling', 'scheduled', 'in_progress', 'dispatched', 'en_route', 'arrived', 'diagnosing', 'awaiting_approval', 'approved', 'parts_required', 'return_visit_needed', 'repairing', 'work_complete', 'ready_to_invoice', 'invoice_sent'];
const job = status => ({ id: 'job', status, customer_id: 'customer', assigned_tech_id: 'tech', scheduled_window: '2026-09-20 09:00-11:00 CT', archived_at: null, work_performed: 'Progress', labor_hours: 2 });
const invoice = (status = 'awaiting_approval', payment_status = 'unpaid') => ({ id: 'invoice', customer_id: 'customer', job_id: 'job', status, payment_status, payment_terms: 'net_7', issued_at: null, due_at: null, revoked_at: null, updated_at: 'before', portal_token: 'token' });
function form(input = {}) { const fd = new FormData(); for (const [k, v] of Object.entries({ jobId: 'job', customerId: 'customer', assignedTechId: '', date: '2026-09-21', start: '09:00', end: '11:00', ...input })) fd.set(k, v); return fd; }
async function redirectOf(task) { try { await task; assert.fail('Expected a redirect'); } catch (error) { if (!error.location) throw error; return new URL(error.location, 'https://preview.test'); } }

test('office can close and cancel every active status, with terminal status errors', async () => {
  for (const status of active) {
    for (const [method, expected] of [['closeCallAction', 'completed'], ['cancelCallAction', 'cancelled']]) {
      const h = harness({ chillbros_jobs: [job(status)] });
      assert.equal((await h.load('lib/chillbros/job-admin-actions.ts')[method]('job')).ok, true);
      assert.equal(h.tables.chillbros_jobs[0].status, expected);
    }
  }
  const h = harness({ chillbros_jobs: [job('paid')] });
  assert.match((await h.load('lib/chillbros/job-admin-actions.ts').closeCallAction('job')).error, /paid/);
});

test('reschedule preserves progress and blank technician; only new calls become scheduled', async () => {
  for (const status of active) {
    const h = harness({ chillbros_jobs: [job(status)], chillbros_profiles: [{ id: 'tech', role: 'technician', status: 'active' }] });
    const url = await redirectOf(h.load('app/schedule/actions.ts').rescheduleJobAction(form()));
    assert.ok(url.searchParams.has('success'), url.href);
    const saved = h.tables.chillbros_jobs[0];
    assert.equal(saved.status, ['new', 'needs_scheduling'].includes(status) ? 'scheduled' : status);
    assert.equal(saved.assigned_tech_id, 'tech');
    assert.equal(saved.work_performed, 'Progress');
    assert.equal(saved.labor_hours, 2);
  }
  for (const status of ['completed', 'cancelled', 'paid']) {
    const h = harness({ chillbros_jobs: [job(status)] });
    const url = await redirectOf(h.load('app/schedule/actions.ts').rescheduleJobAction(form()));
    assert.match(url.searchParams.get('error'), new RegExp(status));
    assert.equal(h.tables.chillbros_jobs[0].scheduled_window, job(status).scheduled_window);
  }
});

test('closed calls do not block slots and email failure is a saved-call warning', async () => {
  const h = harness({ chillbros_jobs: [{ ...job('completed'), scheduled_window: '2026-09-21 09:00-11:00 CT' }], chillbros_customers: [{ id: 'customer' }], chillbros_profiles: [{ id: 'tech', role: 'technician', status: 'active' }] }, { status: 'failed: SMTP unavailable' });
  const url = await redirectOf(h.load('app/schedule/actions.ts').createScheduledJobAction(form({ assignedTechId: 'tech' })));
  assert.equal(h.tables.chillbros_jobs.length, 2);
  assert.equal(url.searchParams.get('success'), 'Call saved.');
  assert.match(url.searchParams.get('warning'), /SMTP unavailable/);
  assert.equal(url.searchParams.has('error'), false);
});

test('recent duplicate and concurrent double submit insert only one call', async () => {
  const h = harness({ chillbros_customers: [{ id: 'customer' }], chillbros_profiles: [{ id: 'tech', role: 'technician', status: 'active' }] });
  const action = h.load('app/schedule/actions.ts').createScheduledJobAction;
  const input = { assignedTechId: 'tech', submissionId: '00000000-0000-4000-8000-000000000001' };
  const urls = await Promise.all([redirectOf(action(form(input))), redirectOf(action(form(input)))]);
  assert.equal(h.tables.chillbros_jobs.length, 1);
  assert.ok(urls.some(url => url.searchParams.get('success') === 'Already saved'));
  const retry = await redirectOf(action(form(input)));
  assert.equal(retry.searchParams.get('success'), 'Already saved');
});

test('office finalizes without signature; failed delivery preserves approval and job progress', async () => {
  for (const status of ['sent', 'failed', 'skipped', 'configuration_required']) {
    const h = harness({ chillbros_jobs: [job('work_complete')], chillbros_invoices: [invoice()] }, { status, recipient: status === 'skipped' ? null : 'test@example.com', error: status === 'sent' ? undefined : 'exact delivery error' }, 'office');
    const result = await h.load('lib/chillbros/billing-actions.ts').finalizeInvoiceAction('invoice');
    assert.equal(result.ok, status === 'sent');
    assert.equal(h.tables.chillbros_invoices[0].status, 'approved');
    assert.equal(h.tables.chillbros_invoices[0].signature_name, 'Approved by Chill Bros office');
    assert.equal(h.tables.chillbros_jobs[0].status, status === 'sent' ? 'invoice_sent' : 'work_complete');
    assert.equal(new Date(h.tables.chillbros_invoices[0].due_at) - new Date(h.tables.chillbros_invoices[0].signed_at), 7 * 86400000);
    assert.equal(h.tables.chillbros_workflow_events[0].stage, 'invoice_finalized');
    if (!result.ok) assert.match(result.error, /Invoice finalized.*exact delivery error/);
  }
});

test('finalize guards status and role, preserves issued_at and never reopens closed jobs', async () => {
  for (const status of ['approved', 'void']) {
    const h = harness({ chillbros_invoices: [invoice(status)] });
    assert.equal((await h.load('lib/chillbros/billing-actions.ts').finalizeInvoiceAction('invoice')).ok, false);
  }
  const denied = harness({ chillbros_invoices: [invoice()] }, undefined, 'technician');
  assert.equal((await denied.load('lib/chillbros/billing-actions.ts').finalizeInvoiceAction('invoice')).ok, false);
  const h = harness({ chillbros_jobs: [job('completed')], chillbros_invoices: [{ ...invoice('draft'), issued_at: '2026-09-01T00:00:00.000Z' }] });
  assert.equal((await h.load('lib/chillbros/billing-actions.ts').finalizeInvoiceAction('invoice')).ok, true);
  assert.equal(h.tables.chillbros_invoices[0].issued_at, '2026-09-01T00:00:00.000Z');
  assert.equal(h.tables.chillbros_jobs[0].status, 'completed');
});

test('only manager can reopen approved unpaid invoices; signature clears and issued_at remains', async () => {
  for (const [role, payment, expected] of [['manager', 'unpaid', true], ['office', 'unpaid', false], ['manager', 'paid', false], ['manager', 'pending_manual_review', false]]) {
    const h = harness({ chillbros_invoices: [{ ...invoice('approved', payment), issued_at: 'original', signature_name: 'Signer', signed_at: 'original' }] }, undefined, role);
    const result = await h.load('lib/chillbros/billing-actions.ts').reopenInvoiceAction('invoice');
    assert.equal(result.ok, expected);
    assert.equal(h.tables.chillbros_invoices[0].issued_at, 'original');
    if (expected) { assert.equal(h.tables.chillbros_invoices[0].signature_name, null); assert.equal(h.tables.chillbros_invoices[0].status, 'awaiting_approval'); }
  }
});

test('save customer email validates, normalizes, persists and reports skipped delivery as failure', async () => {
  const h = harness({ chillbros_invoices: [invoice()], chillbros_customers: [{ id: 'customer', email: null }] });
  const action = h.load('lib/chillbros/billing-actions.ts').saveCustomerEmailAndSendAction;
  assert.equal((await action('invoice', 'bad')).ok, false);
  assert.equal(h.tables.chillbros_customers[0].email, null);
  assert.equal((await action('invoice', ' TEST@EXAMPLE.COM ')).ok, true);
  assert.equal(h.tables.chillbros_customers[0].email, 'test@example.com');
  const failed = harness({ chillbros_invoices: [invoice()] }, { status: 'skipped', recipient: null, error: 'Customer has no email address.' });
  const result = await failed.load('lib/chillbros/billing-actions.ts').sendInvoiceCommunicationAction('invoice', 'email');
  assert.equal(result.ok, false); assert.equal(result.status, 'skipped');
});

test('technician can advance without approval and save notes on legacy active stages', async () => {
  const h = harness({ chillbros_jobs: [job('scheduled')] }, undefined, 'technician');
  const action = h.load('lib/chillbros/job-workflow-v2.ts').updateTechnicianJobV2Action;
  for (const status of ['en_route', 'arrived', 'work_complete']) {
    assert.equal((await action({ jobId: 'job', status, workPerformed: 'Fixed', laborHours: 2, driveHours: 1 })).ok, true);
    assert.equal(h.tables.chillbros_jobs[0].status, status);
  }
  assert.equal((await action({ jobId: 'job', workPerformed: 'Notes only' })).ok, true);
  assert.equal(h.tables.chillbros_jobs[0].status, 'work_complete');
  assert.equal((await action({ jobId: 'job', status: 'completed' })).ok, false);
  const legacy = harness({ chillbros_jobs: [job('awaiting_approval')] }, undefined, 'technician');
  assert.equal((await legacy.load('lib/chillbros/job-workflow-v2.ts').updateTechnicianJobV2Action({ jobId: 'job', status: 'awaiting_approval', workPerformed: 'More notes' })).ok, true);
});

test('lifecycle failures redirect with an actionable invoice link', async () => {
  const h = harness({ chillbros_jobs: [job('work_complete')], chillbros_invoices: [invoice()] });
  const actions = h.load('lib/chillbros/job-lifecycle-actions.ts');
  for (const method of ['startApprovedWorkAction', 'scheduleReturnVisitAction', 'issueInvoiceForCompletedWorkAction']) {
    const url = await redirectOf(actions[method](form({ invoiceId: 'invoice' })));
    assert.equal(url.pathname, '/jobs/job');
    assert.equal(url.searchParams.get('error'), 'Finalize the invoice first');
    assert.equal(url.searchParams.get('invoice'), 'invoice');
  }
});

test('mark paid remains paid when receipt delivery fails and returns the exact failure', async () => {
  const h = harness({ chillbros_invoices: [invoice('approved')] }, { status: 'failed', recipient: 'test@example.com', error: 'SMTP timeout' });
  const result = await h.load('lib/chillbros/estimate-actions-v2.ts').markInvoicePaidV2Action('invoice');
  assert.equal(h.tables.chillbros_invoices[0].payment_status, 'paid');
  assert.equal(result.ok, false);
  assert.match(result.error, /Payment recorded.*SMTP timeout/);
});

test('billing delivery logs use valid enum values and record missing-address failures', async () => {
  for (const status of ['sent', 'configuration_required', 'skipped']) {
    const h = harness({ chillbros_invoices: [{ ...invoice(), invoice_number: 'I-123', customer: { name: 'Test', email: status === 'skipped' ? null : 'test@example.com' } }] }, { status, recipient: 'test@example.com', error: 'Missing GMAIL_SMTP_USER' });
    const result = await h.load('lib/chillbros/billing-delivery.ts').sendBillingDeliveryRecorded('invoice', 'invoice', 'email');
    assert.equal(result.status, status);
    assert.equal(h.tables.chillbros_email_log[0].status, status === 'sent' ? 'sent' : 'failed');
    assert.equal(h.tables.chillbros_delivery_log[0].status, status);
    assert.ok(h.tables.chillbros_delivery_log[0].recipient.length > 0);
    assert.equal(h.tables.chillbros_workflow_events[0].stage, 'invoice_email_' + status);
  }
});
