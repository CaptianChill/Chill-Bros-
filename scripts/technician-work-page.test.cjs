/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness transpiles server actions with dependency doubles. */
/* Technician Work Page regression tests: real server actions against an
 * in-memory Data API double (same approach as core-workflow.test.cjs).
 * Run: node --test scripts/technician-work-page.test.cjs
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');

function harness(seed = {}, profile = { id: 'tech', role: 'technician', email: 'tech@example.com', fullName: 'Tina Tech' }) {
  const tables = structuredClone(seed);
  const uploads = [];
  const db = {
    from(table) {
      const filters = []; let operation = 'read', values, single = false;
      const query = {
        select() { return query; },
        eq(k, v) { filters.push(r => r[k] === v); return query; },
        neq(k, v) { filters.push(r => r[k] !== v); return query; },
        is(k, v) { filters.push(r => (r[k] ?? null) === v); return query; },
        in(k, v) { filters.push(r => v.includes(r[k])); return query; },
        gte(k, v) { filters.push(r => r[k] >= v); return query; },
        not(k, op, v) { filters.push(r => r[k] !== v); return query; },
        order() { return query; },
        limit() { return query; },
        update(input) { operation = 'update'; values = input; return query; },
        insert(input) { operation = 'insert'; values = input; return query; },
        maybeSingle() { single = true; return query; },
        single() { single = true; return query; },
        then(resolve, reject) {
          const rows = tables[table] ??= [];
          let matching = rows.filter(r => filters.every(f => f(r)));
          if (operation === 'insert') { const row = { id: `${table}-${rows.length + 1}`, created_at: new Date().toISOString(), ...values }; rows.push(row); matching = [row]; }
          if (operation === 'update') matching.forEach(r => Object.assign(r, values));
          return Promise.resolve({ data: structuredClone(single ? matching[0] ?? null : matching), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    storage: { from: () => ({ upload: async (p) => { uploads.push(p); return { error: null }; }, remove: async () => ({ error: null }) }) },
  };
  const mocks = {
    'server-only': {},
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect(location) { throw Object.assign(new Error('redirect'), { location }); } },
    '@/lib/supabase/auth-server': { getCurrentStaffProfile: async () => profile },
    '@/lib/supabase/service-client': { createServiceRoleClient: () => db },
    '@/lib/chillbros/assignment-notifications': { verifyTechnicianAssignment: async () => ({ ok: true }), sendTechnicianAssignmentEmail: async () => ({ sent: true, status: 'sent', recipient: 't@example.com' }) },
  };
  const cache = {};
  function load(file) {
    file = path.resolve(ROOT, file);
    if (cache[file]) return cache[file].exports;
    const mod = cache[file] = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', source)(id => {
      if (mocks[id]) return mocks[id];
      if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
      if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'));
      return require(id);
    }, mod, mod.exports);
    return mod.exports;
  }
  return { tables, uploads, load };
}

const job = (status, extra = {}) => ({ id: 'job', status, customer_id: 'customer', assigned_tech_id: 'tech', scheduled_window: '2026-09-25 09:00-11:00 CT', archived_at: null, work_performed: 'Diagnosis notes', labor_hours: 2, drive_hours: 1, updated_at: 'v1', ...extra });
function form(input) { const fd = new FormData(); for (const [k, v] of Object.entries(input)) fd.set(k, v); return fd; }
async function redirectOf(task) { try { await task; assert.fail('Expected a redirect'); } catch (error) { if (!error.location) throw error; return new URL(error.location, 'https://preview.test'); } }
const rescheduleForm = (extra = {}) => form({ jobId: 'job', date: '2026-09-27', start: '13:00', end: '15:00', reason: 'customer_not_ready', note: '', ...extra });

// ---------------------------------------------------------------------------
// Reschedule

test('assigned technician reschedules their own job on site: same job, new time, history with reason', async () => {
  const h = harness({ chillbros_jobs: [job('diagnosing')] });
  const url = await redirectOf(h.load('app/schedule/actions.ts').rescheduleOwnJobAction(rescheduleForm({ reason: 'no_access', note: 'Gate locked' })));
  assert.equal(url.pathname, '/technician');
  assert.equal(url.searchParams.get('rescheduled'), 'job');
  assert.equal(h.tables.chillbros_jobs.length, 1, 'never creates a new job');
  const saved = h.tables.chillbros_jobs[0];
  assert.equal(saved.scheduled_window, '2026-09-27 13:00-15:00 CT');
  assert.equal(saved.status, 'scheduled');
  assert.equal(saved.work_performed, 'Diagnosis notes', 'notes stay on the job');
  const event = h.tables.chillbros_workflow_events.find(e => e.stage === 'rescheduled');
  assert.ok(event, 'reschedule is logged');
  assert.equal(event.actor_id, 'tech');
  assert.match(event.message, /Tina Tech/);
  assert.match(event.message, /2026-09-25 09:00-11:00 → 2026-09-27 13:00-15:00/);
  assert.match(event.message, /No access — Gate locked/);
});

test('technician reschedule cannot reassign the job to someone else', async () => {
  const h = harness({ chillbros_jobs: [job('arrived')] });
  await redirectOf(h.load('app/schedule/actions.ts').rescheduleOwnJobAction(rescheduleForm({ assignedTechId: 'other-tech' })));
  assert.equal(h.tables.chillbros_jobs[0].assigned_tech_id, 'tech');
});

test("technician cannot reschedule another technician's job", async () => {
  const h = harness({ chillbros_jobs: [job('scheduled', { assigned_tech_id: 'other-tech' })] });
  const url = await redirectOf(h.load('app/schedule/actions.ts').rescheduleOwnJobAction(rescheduleForm()));
  assert.equal(url.pathname, '/technician');
  assert.equal(url.searchParams.has('rescheduled'), false);
  assert.equal(h.tables.chillbros_jobs[0].scheduled_window, '2026-09-25 09:00-11:00 CT');
  assert.equal((h.tables.chillbros_workflow_events ?? []).length, 0);
});

test('office-only reschedule still rejects technicians', async () => {
  const h = harness({ chillbros_jobs: [job('scheduled')] });
  const url = await redirectOf(h.load('app/schedule/actions.ts').rescheduleJobAction(rescheduleForm()));
  assert.equal(url.pathname, '/');
  assert.equal(h.tables.chillbros_jobs[0].scheduled_window, '2026-09-25 09:00-11:00 CT');
});

test('reschedule status mapping (owner-approved)', () => {
  const { technicianRescheduleStatus } = harness().load('lib/chillbros/work-page.ts');
  const cases = [
    ['scheduled', 'other', 'scheduled'], ['en_route', 'other', 'scheduled'],
    ['arrived', 'customer_not_ready', 'scheduled'], ['diagnosing', 'waiting_on_parts', 'parts_required'],
    ['parts_required', 'out_of_time', 'parts_required'], ['return_visit_needed', 'other', 'return_visit_needed'],
    ['awaiting_approval', 'other', 'awaiting_approval'], ['repairing', 'out_of_time', 'return_visit_needed'],
    ['repairing', 'waiting_on_parts', 'parts_required'], ['work_complete', 'other', null], ['paid', 'other', null], ['cancelled', 'other', null],
  ];
  for (const [from, reason, expected] of cases) assert.equal(technicianRescheduleStatus(from, reason), expected, `${from}/${reason}`);
});

test('a work-complete job cannot be rescheduled from the field', async () => {
  const h = harness({ chillbros_jobs: [job('work_complete')] });
  const url = await redirectOf(h.load('app/schedule/actions.ts').rescheduleOwnJobAction(rescheduleForm()));
  assert.match(url.searchParams.get('error'), /can't be rescheduled/);
  assert.equal(h.tables.chillbros_jobs[0].scheduled_window, '2026-09-25 09:00-11:00 CT');
});

// ---------------------------------------------------------------------------
// Part status

const partsSeed = (assigned = 'tech', status = 'diagnosing') => ({
  chillbros_jobs: [job(status, { assigned_tech_id: assigned })],
  chillbros_job_parts: [{ id: 'jp1', job_id: 'job', part_id: 'p1', quantity: 1, field_status: null, notes: null, job: { assigned_tech_id: assigned, status } }],
});

test('part field status and notes persist', async () => {
  const h = harness(partsSeed());
  const result = await h.load('lib/chillbros/job-parts.ts').setJobPartFieldAction('jp1', { fieldStatus: 'need_to_order', notes: 'Ask Johnstone' });
  assert.deepEqual(result, { ok: true });
  assert.equal(h.tables.chillbros_job_parts[0].field_status, 'need_to_order');
  assert.equal(h.tables.chillbros_job_parts[0].notes, 'Ask Johnstone');
});

test('invalid part status is rejected', async () => {
  const h = harness(partsSeed());
  const result = await h.load('lib/chillbros/job-parts.ts').setJobPartFieldAction('jp1', { fieldStatus: 'lost', notes: '' });
  assert.equal(result.ok, false);
  assert.equal(h.tables.chillbros_job_parts[0].field_status, null);
});

test("technician cannot change parts on another technician's job", async () => {
  const h = harness(partsSeed('other-tech'));
  const result = await h.load('lib/chillbros/job-parts.ts').setJobPartFieldAction('jp1', { fieldStatus: 'ordered', notes: '' });
  assert.equal(result.ok, false);
  assert.equal(h.tables.chillbros_job_parts[0].field_status, null);
});

test('part status labels: legacy NULL rows show as On truck', () => {
  const { partFieldStatusLabel } = harness().load('lib/chillbros/work-page.ts');
  assert.equal(partFieldStatusLabel(null), 'On truck');
  assert.equal(partFieldStatusLabel('need_to_order'), 'Need to order');
});

// ---------------------------------------------------------------------------
// Receipts stay internal

const CUSTOMER_FACING = [
  'app/portal', 'app/agreement', 'app/api/portal',
  'lib/chillbros/invoice-pdf.ts', 'lib/chillbros/billing-delivery.ts', 'lib/chillbros/customer-communications.ts',
  'lib/chillbros/invoice-v2.ts', 'lib/chillbros/billing-receipts.ts', 'lib/chillbros/approval-notifications.ts', 'lib/chillbros/queries.ts',
];
function filesUnder(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return [full];
  return fs.readdirSync(full, { recursive: true }).map(f => path.join(full, f)).filter(f => /\.(ts|tsx)$/.test(f));
}

test('receipts never reach portal, PDF or customer email code', () => {
  for (const file of CUSTOMER_FACING.flatMap(filesUnder)) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /chillbros_job_receipts|work-page-queries|receipts\//, `${path.relative(ROOT, file)} must not read internal receipts`);
  }
  // Only the staff Work Page modules touch the receipts table.
  const readers = filesUnder('app').concat(filesUnder('lib'), filesUnder('components'))
    .filter(f => fs.readFileSync(f, 'utf8').includes('chillbros_job_receipts'))
    .map(f => path.relative(ROOT, f)).sort();
  assert.deepEqual(readers, ['lib/chillbros/work-page-actions.ts', 'lib/chillbros/work-page-queries.ts']);
});

test("technician cannot add a receipt to another technician's job", async () => {
  const h = harness({ chillbros_jobs: [job('repairing', { assigned_tech_id: 'other-tech' })] });
  const fd = form({ jobId: 'job', vendor: 'Supply', amount: '12.50' });
  fd.set('file', new File([new Uint8Array([1, 2, 3])], 'r.jpg', { type: 'image/jpeg' }));
  const result = await h.load('lib/chillbros/work-page-actions.ts').uploadJobReceiptAction(fd);
  assert.equal(result.ok, false);
  assert.equal((h.tables.chillbros_job_receipts ?? []).length, 0);
  assert.equal(h.uploads.length, 0);
});

test('assigned technician adds a receipt; only office/manager may mark it for the invoice', async () => {
  const h = harness({ chillbros_jobs: [job('repairing')] });
  const actions = h.load('lib/chillbros/work-page-actions.ts');
  const fd = form({ jobId: 'job', vendor: 'Johnstone', amount: '$42.10', note: 'Capacitor' });
  fd.set('file', new File([new Uint8Array([1, 2, 3])], 'r.jpg', { type: 'image/jpeg' }));
  assert.deepEqual(await actions.uploadJobReceiptAction(fd), { ok: true });
  const receipt = h.tables.chillbros_job_receipts[0];
  assert.match(receipt.storage_path, /^receipts\/job\//);
  assert.equal(receipt.amount, 42.1);
  assert.equal(receipt.show_on_invoice, undefined, 'defaults to false in the database');
  const toggle = await actions.setReceiptShowOnInvoiceAction(receipt.id, true);
  assert.equal(toggle.ok, false);
});

// ---------------------------------------------------------------------------
// Signature gating

test('on-site signature is refused during diagnosis and while waiting on parts', async () => {
  for (const status of ['arrived', 'diagnosing', 'parts_required', 'return_visit_needed', 'awaiting_approval']) {
    const h = harness({ chillbros_jobs: [job(status)] });
    const result = await h.load('lib/chillbros/work-page-actions.ts').captureJobSignatureAction({ jobId: 'job', signerName: '', signaturePng: null, customerUnavailable: true });
    assert.equal(result.ok, false, status);
    assert.equal((h.tables.chillbros_job_signatures ?? []).length, 0, status);
  }
});

test('on-site signature is accepted once repairing or later', async () => {
  const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64')}`;
  for (const status of ['repairing', 'work_complete', 'ready_to_invoice']) {
    const h = harness({ chillbros_jobs: [job(status)] });
    const result = await h.load('lib/chillbros/work-page-actions.ts').captureJobSignatureAction({ jobId: 'job', signerName: 'Pat Customer', signaturePng: png, customerUnavailable: false });
    assert.deepEqual(result, { ok: true }, status);
    assert.match(h.tables.chillbros_job_signatures[0].storage_path, /^signatures\/job\//);
  }
  const gate = harness().load('lib/chillbros/work-page.ts').canCaptureSignature;
  assert.equal(gate('diagnosing'), false);
  assert.equal(gate('repairing'), true);
});

test('a non-PNG signature payload is rejected', async () => {
  const h = harness({ chillbros_jobs: [job('repairing')] });
  const result = await h.load('lib/chillbros/work-page-actions.ts').captureJobSignatureAction({ jobId: 'job', signerName: 'Pat', signaturePng: 'data:image/png;base64,AAAA', customerUnavailable: false });
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// Other technicians' jobs

test("technician cannot edit, report on or sign another technician's job", async () => {
  const seed = { chillbros_jobs: [job('repairing', { assigned_tech_id: 'other-tech' })] };
  const h = harness(seed);
  const workflow = await h.load('lib/chillbros/job-workflow-v2.ts').updateTechnicianJobV2Action({ jobId: 'job', workPerformed: 'hijack' });
  assert.equal(workflow.ok, false);
  const report = await h.load('lib/chillbros/work-page-actions.ts').saveRepairReportAction({ jobId: 'job', outcome: 'completed', workPerformed: 'x', finalNotes: '' });
  assert.equal(report.ok, false);
  const signature = await h.load('lib/chillbros/work-page-actions.ts').captureJobSignatureAction({ jobId: 'job', signerName: '', signaturePng: null, customerUnavailable: true });
  assert.equal(signature.ok, false);
  assert.equal(h.tables.chillbros_jobs[0].work_performed, 'Diagnosis notes');
  assert.equal((h.tables.chillbros_workflow_events ?? []).length, 0);
});

test('Work Page and landing only open jobs assigned to the signed-in technician', () => {
  const page = fs.readFileSync(path.join(ROOT, 'app/jobs/[id]/page.tsx'), 'utf8');
  assert.match(page, /profile\.role === "technician" && lifecycle\.job\.assignedTechId !== profile\.id\) redirect\("\/technician"\)/);
  const landing = fs.readFileSync(path.join(ROOT, 'app/technician/page.tsx'), 'utf8');
  assert.match(landing, /isManager \|\| job\.assignedTechId === profile\.id/);
});

// ---------------------------------------------------------------------------
// Field status changes

test('status-only change keeps saved notes and hours', async () => {
  const h = harness({ chillbros_jobs: [job('arrived')] });
  const result = await h.load('lib/chillbros/job-workflow-v2.ts').updateTechnicianJobV2Action({ jobId: 'job', status: 'diagnosing' });
  assert.deepEqual(result, { ok: true });
  const saved = h.tables.chillbros_jobs[0];
  assert.equal(saved.status, 'diagnosing');
  assert.equal(saved.work_performed, 'Diagnosis notes');
  assert.equal(saved.labor_hours, 2);
  assert.equal(saved.drive_hours, 1);
});

test('field status transitions only allow valid next steps', async () => {
  const { fieldNextStatuses, canFieldSetStatus } = harness().load('lib/chillbros/work-page.ts');
  assert.ok(fieldNextStatuses('diagnosing').includes('parts_required'));
  assert.ok(fieldNextStatuses('scheduled').includes('en_route'));
  assert.equal(canFieldSetStatus('scheduled', 'paid'), false);
  assert.equal(canFieldSetStatus('arrived', 'invoice_sent'), false);
  assert.deepEqual(fieldNextStatuses('paid'), []);
  const h = harness({ chillbros_jobs: [job('scheduled')] });
  const result = await h.load('lib/chillbros/job-workflow-v2.ts').updateTechnicianJobV2Action({ jobId: 'job', status: 'paid' });
  assert.equal(result.ok, false);
  assert.equal(h.tables.chillbros_jobs[0].status, 'scheduled');
});
