/* eslint-disable @typescript-eslint/no-require-imports -- approved quote -> Unassigned routing checks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const read = (f) => fs.readFileSync(f, 'utf8');

function loadRouting() {
  const out = ts.transpileModule(read('lib/chillbros/approved-job-routing.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', out)((id) => (id === 'server-only' ? {} : require(id)), mod, mod.exports);
  return mod.exports;
}

// Minimal stand-in for the Supabase query builder that records the update and its filters.
function fakeSupabase(currentStatus) {
  const calls = { update: null, eq: [], in: null, is: null };
  const builder = {
    update(values) { calls.update = values; return builder; },
    eq(col, val) { calls.eq.push([col, val]); return builder; },
    in(col, vals) { calls.in = [col, vals]; return builder; },
    is(col, val) { calls.is = [col, val]; return builder; },
    select() { return builder; },
    async maybeSingle() { return { data: calls.in[1].includes(currentStatus) ? { id: 'job-1' } : null, error: null }; },
  };
  return { calls, client: { from: (table) => { calls.table = table; return builder; } } };
}

test('an approved quote on a closed call moves the same job to Unassigned', async () => {
  const { routeApprovedJob, APPROVED_NEEDS_SCHEDULING } = loadRouting();
  const { calls, client } = fakeSupabase('completed');
  const result = await routeApprovedJob(client, 'job-1', '2026-10-06T00:00:00Z');
  assert.equal(result.movedToUnassigned, true);
  assert.equal(calls.table, 'chillbros_jobs');
  assert.deepEqual(calls.eq, [['id', 'job-1']]);
  assert.equal(calls.update.status, 'needs_scheduling');
  assert.equal(calls.update.assigned_tech_id, null);
  assert.equal(calls.update.scheduled_window, APPROVED_NEEDS_SCHEDULING);
  assert.deepEqual(calls.is, ['archived_at', null]);
});

test('a tech still on site keeps the job so they can start it with Work Now', async () => {
  const { routeApprovedJob } = loadRouting();
  for (const status of ['in_progress', 'arrived', 'diagnosing', 'en_route', 'repairing', 'scheduled', 'paid', 'cancelled']) {
    const { client } = fakeSupabase(status);
    assert.equal((await routeApprovedJob(client, 'job-1', 'now')).movedToUnassigned, false, status);
  }
});

test('both approval paths route the job: customer signature and owner verbal approval', () => {
  assert.match(read('lib/chillbros/job-lifecycle-actions.ts'), /if \(invoice\.job_id\) await routeApprovedJob\(supabase, invoice\.job_id, now\)/);
  const verbal = read('lib/chillbros/quote-actions.ts');
  assert.ok(verbal.indexOf('verbal approval could not be recorded') < verbal.indexOf('await routeApprovedJob(supabase, jobId, now)'), 'routes only after the verbal approval is recorded');
});
