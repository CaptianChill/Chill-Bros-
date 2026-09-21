/* eslint-disable @typescript-eslint/no-require-imports -- Execute real server modules with isolated service doubles. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createHash } = require('node:crypto');
const id = '11111111-1111-4111-8111-111111111111';
const customer = '22222222-2222-4222-8222-222222222222';
const tech = { id: '33333333-3333-4333-8333-333333333333', role: 'technician', fullName: 'Test Technician' };
const manager = { id: '44444444-4444-4444-8444-444444444444', role: 'manager', fullName: 'Test Owner' };
const bytes = Buffer.from([255,216,255,1,2,3]);
const descriptor = { name: 'page.jpg', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
const input = { id, customerId: customer, jobId: null, equipmentId: null, customerNameFreeform: null, technicianNote: 'Test note' };
function harness(options = {}) {
  const tables = { chillbros_field_note_submissions: [], chillbros_field_note_images: [], chillbros_field_note_events: [], chillbros_customers: [{ id: customer }], chillbros_jobs: [], chillbros_equipment: [] };
  const objects = new Map(); const queued = []; let clock = Date.now(); let profile = tech;
  const state = { tables, objects, queued, aiCalls: 0, failure: null, removeError: false, publicBucket: false, beforeAiResult: null };
  const storage = {
    async upload(path, content) { if (objects.has(path)) return { error: { statusCode: '409', message: 'Duplicate' } }; objects.set(path, content); return { error: null }; },
    async info(path) { return objects.has(path) ? { data: { size: objects.get(path).length }, error: null } : { data: null, error: { message: 'Missing photo' } }; },
    async createSignedUrls(paths) { return { data: paths.map(path => ({ signedUrl: `https://private.example/${path}` })), error: null }; },
    async remove(paths) { if (state.removeError) return { error: { message: 'Storage unavailable' } }; paths.forEach(path => objects.delete(path)); return { error: null }; },
  };
  const db = { storage: { getBucket: async () => ({ data: { public: state.publicBucket }, error: null }), from: () => storage }, from(table) {
    const filters = []; let mode = 'read', values, single = false, count = false;
    const q = {
      select(_columns, settings) { count = !!settings?.count; return q; }, order() { return q; }, limit() { return q; },
      eq(k,v) { filters.push(row => row[k] === v); return q; }, is(k,v) { return q.eq(k,v); },
      in(k,v) { filters.push(row => v.includes(row[k])); return q; },
      insert(v) { mode = 'insert'; values = v; return q; }, upsert(v) { mode = 'upsert'; values = v; return q; },
      update(v) { mode = 'update'; values = v; return q; }, delete() { mode = 'delete'; return q; },
      maybeSingle() { single = true; return q; },
      then(resolve,reject) { return Promise.resolve().then(() => {
        if (state.failure?.table === table && state.failure.mode === mode) return { data: null, error: { message: 'Injected database failure' } };
        let matches = tables[table].filter(row => filters.every(f => f(row)));
        if (mode === 'insert' || mode === 'upsert') {
          matches = [];
          for (const value of Array.isArray(values) ? values : [values]) {
            const existing = tables[table].find(row => value.id && row.id === value.id);
            if (existing && mode === 'insert') return { data: null, error: { code: '23505', message: 'Duplicate' } };
            if (!existing) { const row = { updated_at: new Date(++clock).toISOString(), ...value }; tables[table].push(row); matches.push(row); }
          }
        }
        if (mode === 'update') matches.forEach(row => Object.assign(row, values, { updated_at: new Date(++clock).toISOString() }));
        if (mode === 'delete') tables[table] = tables[table].filter(row => !matches.includes(row));
        return { data: structuredClone(single ? matches[0] ?? null : matches), error: null, count: count ? matches.length : null };
      }).then(resolve,reject); },
    }; return q;
  } };
  const mocks = { 'server-only': {}, 'next/server': { after: fn => queued.push(fn) }, 'next/cache': { revalidatePath() {} },
    '@/lib/supabase/service-client': { createServiceRoleClient: () => db },
    '@/lib/supabase/auth-server': { getCurrentStaffProfile: async () => profile },
    './field-notes-ai': { processFieldNoteImages: async () => { state.aiCalls++; await state.beforeAiResult?.(); return options.aiFailure ? { ok: false, error: 'AI unavailable' } : { ok: true, model: 'test', data: { rawTranscription: 'Original', cleanedInternalNotes: 'Internal', customerSummary: 'Customer', confidenceFlags: [] } }; } },
  };
  function load(file) { const mod = { exports: {} }; const source = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; new Function('require','module','exports',source)(name => mocks[name] ?? require(name),mod,mod.exports); return mod.exports; }
  const service = load('lib/chillbros/field-notes-service.ts'); mocks['./field-notes-service'] = service;
  const actions = load('lib/chillbros/field-notes-actions.ts');
  return { ...state, state, service, actions, as: value => { profile = value; }, note: () => tables.chillbros_field_note_submissions[0], async upload() { const p = await service.prepareNote(input,[descriptor],tech); await service.uploadNoteImage(id,p.images[0].id,bytes,tech); return p; }, async ready() { await this.upload(); await service.finishNoteUpload(id,tech); await service.processNote(id); } };
}
test('retrying prepare and upload creates one submission and one immutable image', async () => {
  const h = harness(); await h.upload(); await h.upload(); assert.equal(h.tables.chillbros_field_note_submissions.length,1); assert.equal(h.tables.chillbros_field_note_images.length,1); assert.equal(h.objects.size,1);
  await h.service.finishNoteUpload(id,tech); await h.service.finishNoteUpload(id,tech); assert.equal(h.tables.chillbros_field_note_events.length,1);
});
test('typed-only notes deliver once, process, and retain owner-approved invoice wording', async () => {
  const h = harness();
  h.state.publicBucket = true; // Typed notes must not depend on photo storage.
  await h.service.prepareNote(input, [], tech);
  await h.service.prepareNote(input, [], tech);
  await h.service.finishNoteUpload(id, tech);
  await h.service.finishNoteUpload(id, tech);
  await h.service.processNote(id);
  assert.equal(h.note().status, 'ready');
  assert.equal(h.state.aiCalls, 1);
  assert.equal(h.tables.chillbros_field_note_submissions.length, 1);
  assert.equal(h.tables.chillbros_field_note_images.length, 0);
  h.as(manager);
  assert.equal((await h.actions.updateFieldNoteSubmissionAction(id, { invoiceDescription: 'Cleaned condenser and verified operation.' }, h.note().updated_at)).ok, true);
  assert.equal((await h.actions.approveFieldNoteSubmissionAction(id, h.note().updated_at, true)).ok, true);
  assert.equal((await h.actions.updateFieldNoteSubmissionAction(id, { invoiceDescription: 'Changed after approval' }, h.note().updated_at)).ok, false);
  assert.equal((await h.actions.completeFieldNoteSubmissionAction(id, h.note().updated_at)).ok, true);
  assert.equal(h.note().invoice_description, 'Cleaned condenser and verified operation.');
});
test('empty submissions and equipment from another customer are rejected', async () => {
  const h = harness();
  await assert.rejects(h.service.prepareNote({ ...input, technicianNote: '   ' }, [], tech), /Type your notes/);
  h.tables.chillbros_equipment.push({ id: manager.id, customer_id: tech.id });
  await assert.rejects(h.service.prepareNote({ ...input, equipmentId: manager.id }, [], tech), /equipment belonging/);
  assert.equal(h.tables.chillbros_field_note_submissions.length, 0);
  h.tables.chillbros_equipment[0].customer_id = customer;
  await h.service.prepareNote({ ...input, equipmentId: manager.id }, [], tech);
  assert.equal(h.note().equipment_id, manager.id);
});
test('AI request accepts typed-only input and requires an invoice description in its schema', async () => {
  const requests = [];
  const mod = { exports: {} };
  const ai = {
    gateway: model => model,
    jsonSchema: schema => schema,
    generateObject: async request => { requests.push(request); return { object: { invoiceDescription: 'Cleaned condenser.' } }; },
  };
  const source = ts.transpileModule(fs.readFileSync('lib/chillbros/field-notes-ai.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(name => name === 'ai' ? ai : {}, mod, mod.exports);
  const result = await mod.exports.processFieldNoteImages({ imageUrls: [], technicianNote: 'Cleaned condenser.', customerName: null, equipmentContext: null });
  assert.equal(result.ok, true);
  assert.equal(requests.length, 1);
  assert.match(requests[0].messages[0].content[0].text, /Cleaned condenser/);
  assert.ok(requests[0].schema.required.includes('invoiceDescription'));
  assert.equal((await mod.exports.processFieldNoteImages({ imageUrls: [], technicianNote: ' ', customerName: null, equipmentContext: null })).ok, false);
  assert.equal(requests.length, 1);
});
test('incomplete upload cannot be sent or processed and keeps its draft reservation', async () => {
  const h = harness(); await h.service.prepareNote(input,[descriptor],tech); await assert.rejects(h.service.finishNoteUpload(id,tech),/not finished/); await h.service.processNote(id); assert.equal(h.state.aiCalls,0); assert.equal(h.note().ai_error,h.service.UPLOAD_PENDING);
});
test('another technician cannot upload, finish, or request reprocessing', async () => {
  const h = harness(); const p = await h.upload(); const outsider = { ...tech, id: manager.id }; h.as(outsider);
  await assert.rejects(h.service.uploadNoteImage(id,p.images[0].id,bytes,outsider),/access/); await assert.rejects(h.service.finishNoteUpload(id,outsider),/access/); assert.equal((await h.actions.retryFieldNoteProcessingAction(id)).ok,false); assert.equal(h.queued.length,0);
});
test('rejects oversized, altered, and public-storage photos', async () => {
  const h = harness(); await assert.rejects(h.service.prepareNote(input,[{ ...descriptor,size:4*1024*1024 }],tech),/photo/); h.state.publicBucket = true; await assert.rejects(h.upload(),/private/); h.state.publicBucket = false;
  const p = await h.upload(); await assert.rejects(h.service.uploadNoteImage(id,p.images[0].id,Buffer.from([255,216,255,9]),tech),/changed/);
});
test('validates job ownership and customer association on the server', async () => {
  const h = harness(); const jobId = manager.id; h.tables.chillbros_jobs.push({ id:jobId, customer_id:customer, assigned_tech_id:manager.id, archived_at:null });
  await assert.rejects(h.service.prepareNote({ ...input,jobId },[descriptor],tech),/assigned jobs/); h.tables.chillbros_jobs[0].assigned_tech_id = tech.id; h.tables.chillbros_jobs[0].customer_id = tech.id;
  await assert.rejects(h.service.prepareNote({ ...input,jobId },[descriptor],tech),/belonging/);
});
test('database write failures never return successful delivery', async () => {
  const h = harness(); await h.upload(); h.state.failure = { table:'chillbros_field_note_submissions',mode:'update' }; const result = await h.actions.finishFieldNoteSubmissionAction(id); assert.equal(result.ok,false); assert.equal(h.queued.length,0); assert.equal(h.note().ai_error,h.service.UPLOAD_PENDING);
});
test('AI failure preserves photos and exposes a retryable failed state', async () => {
  const h = harness({ aiFailure:true }); await h.ready(); assert.equal(h.note().status,'processing_failed'); assert.equal(h.objects.size,1); assert.equal(h.note().ai_error,'AI unavailable');
});
test('delayed AI response cannot overwrite a newer worker or owner revision', async () => {
  const h = harness(); await h.upload(); await h.service.finishNoteUpload(id,tech); h.state.beforeAiResult = () => { Object.assign(h.note(),{ status:'approved',updated_at:'new-version',customer_summary:'Owner verified' }); }; await h.service.processNote(id); assert.equal(h.note().status,'approved'); assert.equal(h.note().customer_summary,'Owner verified');
});
test('live processing is not duplicated but stale processing can recover', async () => {
  const h = harness(); await h.upload(); Object.assign(h.note(),{ status:'processing',ai_error:null }); await h.service.processNote(id); assert.equal(h.state.aiCalls,0); h.note().updated_at = new Date(Date.now()-11*60*1000).toISOString(); await h.service.processNote(id); assert.equal(h.note().status,'ready'); assert.equal(h.state.aiCalls,1);
});
test('approval requires manager, current saved revision, linked customer, and explicit review', async () => {
  const h = harness(); await h.ready(); const version = h.note().updated_at; assert.equal((await h.actions.approveFieldNoteSubmissionAction(id,version,true)).ok,false); h.as(manager);
  assert.equal((await h.actions.approveFieldNoteSubmissionAction(id,version,false)).ok,false);
  assert.equal((await h.actions.updateFieldNoteSubmissionAction(id,{ customerSummary:'Reviewed correction' },version)).ok,true);
  assert.equal((await h.actions.approveFieldNoteSubmissionAction(id,version,true)).ok,false);
  assert.equal((await h.actions.approveFieldNoteSubmissionAction(id,h.note().updated_at,true)).ok,true);
  assert.equal((await h.actions.updateFieldNoteSubmissionAction(id,{ customerSummary:'Accidental overwrite' },h.note().updated_at)).ok,false);
  assert.equal(h.note().customer_summary,'Reviewed correction'); assert.equal(h.objects.size,1);
});
test('only completed verified notes lose photos; cleanup failure retains retry metadata and text', async () => {
  const h = harness(); await h.ready(); await assert.rejects(h.service.cleanupNotePhotos(id,manager.id),/Complete/); h.as(manager);
  await h.actions.approveFieldNoteSubmissionAction(id,h.note().updated_at,true); h.state.removeError = true;
  const result = await h.actions.completeFieldNoteSubmissionAction(id,h.note().updated_at); assert.equal(result.ok,false); assert.equal(h.note().status,'completed'); assert.equal(h.objects.size,1); assert.equal(h.tables.chillbros_field_note_images.length,1); assert.equal(h.note().customer_summary,'Customer');
  h.state.removeError = false; assert.equal((await h.actions.completeFieldNoteSubmissionAction(id,h.note().updated_at)).ok,true); assert.equal(h.objects.size,0); assert.equal(h.tables.chillbros_field_note_images.length,0); assert.equal(h.note().customer_summary,'Customer');
});
