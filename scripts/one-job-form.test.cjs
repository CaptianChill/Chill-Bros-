/* eslint-disable @typescript-eslint/no-require-imports -- Static checks that every "new service call" entry point opens the one /jobs/new form. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (f) => fs.readFileSync(f, 'utf8');

const schedule = read('app/schedule/page.tsx');
const dispatch = read('app/dispatch/page.tsx');
const panel = read('components/dispatch-panel.tsx');
const page = read('app/jobs/new/page.tsx');
const form = read('components/new-service-call-form.tsx');
const intake = read('lib/chillbros/equipment-job-intake.ts');

test('schedule links to /jobs/new with the day prefilled instead of its own call form', () => {
  assert.match(schedule, /\/jobs\/new\?/);
  assert.match(schedule, /date, from: "schedule"/);
  assert.match(schedule, /New service call/);
  assert.doesNotMatch(schedule, /createScheduledJobAction/);
  assert.doesNotMatch(schedule, /Schedule service call/);
});

test('schedule keeps team meetings, reschedule, delete and add customer', () => {
  assert.match(schedule, /action=\{createTeamMeetingAction\}/);
  assert.match(schedule, /action=\{rescheduleJobAction\}/);
  assert.match(schedule, /<ScheduleDeleteButton/);
  assert.match(schedule, /action=\{createScheduleCustomerAction\}/);
});

test('dispatch links to /jobs/new and no longer renders duplicate create forms', () => {
  assert.match(dispatch, /\/jobs\/new/);
  assert.doesNotMatch(dispatch, /<EquipmentFirstIntake/);
  assert.match(dispatch, /<DispatchPanel/);
  assert.match(dispatch, /<DispatchAssignRow/);
  assert.match(dispatch, /<JobAssetReturnPanel/);
  assert.doesNotMatch(panel, /createJobAction/);
  assert.match(panel, /href="\/jobs\/new"/);
});

test('old server actions are still exported for other callers', () => {
  assert.match(read('app/schedule/actions.ts'), /export async function createScheduledJobAction/);
  assert.match(read('lib/chillbros/operations.ts'), /export async function createJobAction/);
  assert.match(read('components/equipment-first-intake.tsx'), /export function EquipmentFirstIntake/);
});

test('/jobs/new reads prefill from searchParams', () => {
  assert.match(page, /searchParams: Promise<\{[^}]*customer\?: string; equipment\?: string; tech\?: string; date\?: string; from\?: string/);
  assert.match(page, /await Promise\.all\(\[[^\]]*searchParams\]\)/);
  for (const prop of ['initialCustomerId', 'initialEquipmentId', 'initialTechId', 'initialDate', 'returnTo']) {
    assert.match(page, new RegExp(`${prop}=\\{`), `${prop} not passed`);
    assert.match(form, new RegExp(`${prop}\\?:`), `${prop} not accepted by form`);
  }
});

test('/jobs/new keeps every capability the old forms had', () => {
  assert.match(form, /createCustomerAction/, 'new customer');
  assert.match(form, /createEquipmentAction/, 'new equipment');
  assert.match(form, /equipmentId: unitId/, 'link saved unit');
  assert.match(form, /assignedTechId: techId/, 'assign technician');
  assert.match(form, /type="date"/, 'date');
  assert.match(form, /length: 48/, 'full-day time slots like the schedule had');
  assert.match(form, /location:/, 'service location');
  assert.match(form, /scope: fullScope/, 'complaint');
  assert.match(form, /submissionId/, 'double-submit guard');
  assert.match(intake, /That technician is already scheduled/, 'technician double-booking check');
  assert.match(intake, /sendTechnicianAssignmentEmail\(job\.id, "assigned"\)/, 'technician email');
  assert.match(intake, /23505/, 'duplicate submit returns the saved call');
});
