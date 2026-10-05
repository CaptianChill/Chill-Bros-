/* eslint-disable @typescript-eslint/no-require-imports -- Static checks that the tech job screen is the hub for the current call. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (f) => fs.readFileSync(f, 'utf8');

const tech = read('app/technician/page.tsx');
const notesPage = read('app/field-notes/page.tsx');
const notesForm = read('components/field-notes-intake-form.tsx');
const equipmentPage = read('app/equipment/[id]/page.tsx');

test('call customer uses a tel: link from the customer record, only when a phone exists', () => {
  assert.match(tech, /getCustomerProfile\(job\.customerId\)/);
  assert.match(tech, /customerProfile\?\.customer\.phone/);
  assert.match(tech, /`tel:\$\{phoneDigits\}`/);
  assert.match(tech, /\{callHref \? <a href=\{callHref\}[^]*?Call customer<\/a> : null\}/);
});

test('directions open a Google Maps search for the job location, only when one exists', () => {
  assert.match(tech, /https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=\$\{encodeURIComponent\(serviceAddress\)\}/);
  assert.match(tech, /job\?\.location\?\.trim\(\) \|\| customerProfile\?\.customer\.address/);
  assert.match(tech, /\{directionsHref \? <a href=\{directionsHref\}[^]*?Directions<\/a> : null\}/);
});

test('contact and tool tiles sit in one boxed grid above the stage buttons', () => {
  const grid = tech.indexOf('aria-label="Call tools"');
  const editor = tech.indexOf('<TechnicianJobEditor');
  assert.ok(grid > 0 && grid < editor, 'tool grid should come before TechnicianJobEditor');
  const block = tech.slice(grid, editor);
  assert.match(block, /grid-cols-3/);
  for (const label of ['Call customer', 'Directions', 'Tech Assist', 'Add note', 'Parts Pro']) assert.ok(block.includes(label), `${label} missing from tool grid`);
});

test('Add note opens Field Notes for this job', () => {
  assert.match(tech, /href=\{`\/field-notes\?job=\$\{job\.id\}`\}/);
});

test('field notes only preselects a job the user is allowed to see', () => {
  assert.match(notesPage, /searchParams: Promise<\{ job\?: string \}>/);
  assert.match(notesPage, /jobs\.some\(\(job\) => job\.id === params\.job\)/);
  assert.match(notesPage, /preselectedJobId=\{preselectedJobId\}/);
  assert.match(notesForm, /preselectedJobId && jobs\.some\(j => j\.id === preselectedJobId\)/);
  assert.match(notesForm, /const initialJobId = preselected \|\| /);
});

test('equipment cards link to the full unit record, and techs can open it', () => {
  assert.match(tech, /<Link key=\{asset\.id\} href=\{`\/equipment\/\$\{asset\.id\}`\}/);
  assert.match(equipmentPage, /\["manager", "office", "technician"\]\.includes\(profile\.role\)/);
});

test('manager view of the job screen is untouched', () => {
  assert.match(tech, /const isManager = profile\.role === "manager";/);
  assert.match(tech, /isManager\s*\? await getDispatchJobs\(250\)/);
  assert.match(tech, /\{isManager && invoice\.status !== "approved" \? <OwnerEstimateEditor/);
});
