/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness. */
// Lead Autopilot pure logic: open-slot math, send windows and throttle,
// sequence timing, playbook guardrails, and website email extraction.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file) {
  const source = ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)(require, mod, mod.exports);
  return mod.exports;
}

const slots = load('lib/chillbros/autopilot/slots.ts');
const timing = load('lib/chillbros/autopilot/timing.ts');
const playbook = load('lib/chillbros/autopilot/playbook.ts');
const extract = load('lib/chillbros/autopilot/email-extract.ts');
const audience = load('lib/chillbros/autopilot/audience.ts');

const SETTINGS = { workday_start: '08:00', workday_end: '17:00', saturday_start: null, saturday_end: null, slot_minutes: 120, jobs_per_slot: null, booking_days_ahead: 7, min_lead_hours: 3 };
// Monday 2026-10-26 07:00 Central = 12:00 UTC (CDT, UTC-5).
const MON_7AM = new Date('2026-10-26T12:00:00Z');

test('weekday slots run from opening to closing in slot-length steps', () => {
  const open = slots.computeOpenSlots(SETTINGS, [], 2, MON_7AM);
  const monday = open.filter((s) => s.date === '2026-10-26');
  // 3-hour lead from 7:00 means the 8:00 slot is gone; 10, 12, 14 remain (16:00 would end after 17:00).
  assert.deepEqual(monday.map((s) => s.start), ['10:00', '12:00', '14:00']);
  assert.equal(monday[0].window, '2026-10-26 10:00-12:00 CT');
  assert.equal(monday[0].free, 2);
});

test('weekends are closed unless Saturday hours are set', () => {
  const open = slots.computeOpenSlots(SETTINGS, [], 1, MON_7AM);
  assert.ok(!open.some((s) => s.date === '2026-10-31' || s.date === '2026-11-01'));
  const sat = slots.computeOpenSlots({ ...SETTINGS, saturday_start: '09:00', saturday_end: '13:00' }, [], 1, MON_7AM);
  assert.deepEqual(sat.filter((s) => s.date === '2026-10-31').map((s) => s.start), ['09:00', '11:00']);
});

test('booked jobs consume capacity; cancelled, archived and free-text windows do not', () => {
  const jobs = [
    { scheduled_window: '2026-10-27 08:00-10:00 CT', status: 'scheduled' },
    { scheduled_window: '2026-10-27 09:00-11:00 CT', status: 'in_progress' },
    { scheduled_window: '2026-10-27 12:00-14:00 CT', status: 'cancelled' },
    { scheduled_window: '2026-10-27 14:00-16:00 CT', status: 'scheduled', archived_at: '2026-10-20' },
    { scheduled_window: 'Approved · needs scheduling', status: 'needs_scheduling' },
  ];
  const tue = slots.computeOpenSlots(SETTINGS, jobs, 2, MON_7AM).filter((s) => s.date === '2026-10-27');
  // 08-10 has two overlapping jobs (full for 2 techs); 10-12 overlaps the 09-11 job (1 free).
  assert.deepEqual(tue.map((s) => [s.start, s.free]), [['10:00', 1], ['12:00', 2], ['14:00', 2]]);
});

test('jobs_per_slot overrides technician count', () => {
  const tue = slots.computeOpenSlots({ ...SETTINGS, jobs_per_slot: 1 }, [{ scheduled_window: '2026-10-27 08:00-10:00 CT', status: 'scheduled' }], 5, MON_7AM).filter((s) => s.date === '2026-10-27');
  assert.equal(tue[0].start, '10:00');
});

test('late-evening lead time pushes the first slot to the next business day', () => {
  // Friday 2026-10-30 22:00 Central.
  const open = slots.computeOpenSlots({ ...SETTINGS, min_lead_hours: 12 }, [], 1, new Date('2026-10-31T03:00:00Z'));
  // Ready Saturday 10:00, but Saturdays are closed, so Monday opens at 08:00.
  assert.equal(open[0].date, '2026-11-02');
  assert.equal(open[0].start, '08:00');
});

test('openSlotCount sums free capacity inside the horizon', () => {
  const open = slots.computeOpenSlots(SETTINGS, [], 2, MON_7AM);
  assert.equal(slots.openSlotCount(open, '2026-10-26', 1), (3 + 4) * 2);
});

test('lanes only fire in their best window', () => {
  assert.equal(timing.laneIsOpen('cold_kitchen', 2, 14), true);
  assert.equal(timing.laneIsOpen('cold_kitchen', 2, 12), false); // lunch rush
  assert.equal(timing.laneIsOpen('cold_kitchen', 5, 14), false); // Friday
  assert.equal(timing.laneIsOpen('cold_office', 3, 9), true);
  assert.equal(timing.laneIsOpen('reactivation', 1, 9), false); // Monday
  assert.equal(timing.laneIsOpen('inbound_followup', 0, 22), false); // no late-night nudges
  assert.equal(timing.laneForServiceLine('refrigeration'), 'cold_kitchen');
  assert.equal(timing.laneForServiceLine('hvac_r'), 'cold_office');
});

test('batch size is throttled by open schedule and spread over the window', () => {
  const base = { lane: 'cold_kitchen', weekday: 2, hour: 14, sendsPerSlot: 10, dailyCap: 15, sentToday: 0 };
  assert.equal(timing.batchSize({ ...base, openSlots: 0 }), 0);
  assert.equal(timing.batchSize({ ...base, openSlots: 1 }), 5); // budget 10 over 2 runs
  assert.equal(timing.batchSize({ ...base, openSlots: 20 }), 8); // cap 15 over 2 runs
  assert.equal(timing.batchSize({ ...base, openSlots: 20, hour: 15, sentToday: 8 }), 7);
  assert.equal(timing.batchSize({ ...base, openSlots: 20, sentToday: 15 }), 0);
  assert.equal(timing.batchSize({ ...base, openSlots: 20, hour: 11 }), 0);
});

test('cold sequence: 3 emails spaced 0, 3, then 4 more days', () => {
  const now = new Date('2026-10-26T20:00:00Z');
  assert.equal(timing.coldStepDue(0, null, now), true);
  assert.equal(timing.coldStepDue(1, '2026-10-24T20:00:00Z', now), false);
  assert.equal(timing.coldStepDue(1, '2026-10-23T20:00:00Z', now), true);
  assert.equal(timing.coldStepDue(2, '2026-10-23T20:00:00Z', now), false);
  assert.equal(timing.coldStepDue(2, '2026-10-22T20:00:00Z', now), true);
  assert.equal(timing.coldStepDue(3, '2026-01-01T00:00:00Z', now), false);
});

test('inbound nudges at about 2 hours, 1 day and 3 days, then stop', () => {
  const first = '2026-10-26T12:00:00Z';
  assert.equal(timing.inboundNudgeDue(1, first, new Date('2026-10-26T13:00:00Z')), false);
  assert.equal(timing.inboundNudgeDue(1, first, new Date('2026-10-26T14:30:00Z')), true);
  assert.equal(timing.inboundNudgeDue(2, first, new Date('2026-10-27T12:30:00Z')), true);
  assert.equal(timing.inboundNudgeDue(3, first, new Date('2026-10-29T13:00:00Z')), true);
  assert.equal(timing.inboundNudgeDue(4, first, new Date('2026-11-30T13:00:00Z')), false);
});

test('playbook carries the configured fee and hood cleaning, and blocks invented prices', () => {
  const s = { residential_service_fee: '$155 (includes trip and the first hour of diagnostic)', commercial_service_fee: '$155 (includes trip and the first hour of diagnostic)', hood_cleaning_active: true, allow_reference_customers: false };
  const text = playbook.buildPlaybook(s);
  assert.match(text, /\$155/);
  assert.match(text, /NFPA 96/);
  assert.match(text, /do not name any customers/i);
  assert.equal(playbook.hasUnapprovedPrice('The service call is $155 and covers the trip.', s), false);
  assert.equal(playbook.hasUnapprovedPrice('A new compressor runs about $1,800.', s), true);
  assert.equal(playbook.hasUnapprovedPrice('Any price at all: $99', { ...s, residential_service_fee: null, commercial_service_fee: null }), true);
  assert.doesNotMatch(playbook.buildPlaybook({ ...s, hood_cleaning_active: false }), /exhaust \(vent hood\) cleaning:/);
  assert.equal(playbook.containsUrl('Book at https://x.com'), true);
});

test('urgency triage', () => {
  assert.equal(playbook.classifyUrgency('I smell gas near the furnace'), 'emergency');
  assert.equal(playbook.classifyUrgency('Walk-in cooler is at 50 degrees'), 'urgent');
  assert.equal(playbook.classifyUrgency('Would like a spring tune-up'), 'routine');
});

test('website email extraction prefers the business domain and skips junk', () => {
  const html = `<a href="mailto:Info@TacosRio.com">email</a> noreply@tacosrio.com sentry@o123.ingest.sentry.io logo@2x.png owner@gmail.com`;
  assert.equal(extract.pickBusinessEmail(html, 'https://www.tacosrio.com/'), 'info@tacosrio.com');
  assert.equal(extract.pickBusinessEmail('contact us: joe [at] joesbbq.com', 'https://joesbbq.com'), 'joe@joesbbq.com');
  assert.equal(extract.pickBusinessEmail('<p>no emails here</p>', 'https://x.com'), null);
  // A designer credit in plain text is not the business's contact; a linked group inbox is.
  assert.equal(extract.pickBusinessEmail('Site by Astigmatic astigma@astigmatic.com', 'https://thestationcafe.com'), null);
  assert.equal(extract.pickBusinessEmail('<a href="mailto:prw@joesfood.com">Email us</a>', 'https://paesanosriverwalk.com'), 'prw@joesfood.com');
  assert.equal(extract.pickBusinessEmail('Call or email alamofarmsinc@gmail.com', 'https://alamofarms.com'), 'alamofarmsinc@gmail.com');
  assert.equal(extract.websiteFromSummary('Automatically discovered. Website: www.tacosrio.com. Office review.'), 'https://www.tacosrio.com/');
  assert.equal(extract.websiteFromSummary('No site listed.'), null);
});

test('cold outreach skips placeholder, third-party and wrong-department addresses', () => {
  for (const bad of ['johnsmith@gmail.com', 'info@mysite.com', 'press@linktr.ee', 'help@instacart.com', '05%7c02%7ckmartinez@parryspizza.com', 'sareservations@valenciagroup.com', 'media@moanarestaurantgroup.com', 'careers@acme.com', 'noreply@acme.com']) {
    assert.equal(extract.isUsableOutreachEmail(bad), false, bad);
  }
  for (const good of ['admin@panasiamarket.com', 'alamofarmsinc@gmail.com', 'managers@acenar.com', 'guestservice@lafamiliacortez.com', 'hello@torokitchenandbar.com']) {
    assert.equal(extract.isUsableOutreachEmail(good), true, good);
  }
});

test('company, owner and test records never get check-ins', () => {
  assert.equal(audience.isInternalOrTestCustomer('Chill Pros Customer', 'x@y.com', ''), true);
  assert.equal(audience.isInternalOrTestCustomer('Demo Customer (Brae test)', 'someone@gmail.com', ''), true);
  assert.equal(audience.isInternalOrTestCustomer('Blah blah', 'a@b.com', ''), true);
  assert.equal(audience.isInternalOrTestCustomer('Real Cafe', 'chillprostx@gmail.com', ''), true);
  assert.equal(audience.isInternalOrTestCustomer('Real Cafe', 'office@chillpros.com', 'office@chillpros.com'), true);
  assert.equal(audience.isInternalOrTestCustomer('Nordstrom', 'george.ogbidi@nordstrom.com', ''), false);
});

test('restaurants also get weekend afternoons; offices do not', () => {
  assert.equal(timing.laneIsOpen('cold_kitchen', 6, 14), true); // Saturday
  assert.equal(timing.laneIsOpen('cold_kitchen', 0, 15), true); // Sunday
  assert.equal(timing.laneIsOpen('cold_office', 6, 9), false);
});

test('the new-customer offer is an approved price and appears in the playbook', () => {
  const s = { residential_service_fee: '$155 (includes trip and the first hour of diagnostic)', commercial_service_fee: '$155', hood_cleaning_active: true, allow_reference_customers: false, first_time_offer: '$99 first service call (normally $155)' };
  assert.equal(playbook.hasUnapprovedPrice('New customers pay $99 for the first service call.', s), false);
  assert.equal(playbook.hasUnapprovedPrice('Get $50 off any repair.', s), true);
  assert.match(playbook.buildPlaybook(s), /NEW-CUSTOMER OFFER/);
  assert.doesNotMatch(playbook.buildPlaybook({ ...s, first_time_offer: null }), /NEW-CUSTOMER OFFER/);
});
