// When each outreach lane sends, and how many per hourly run. Pure functions.
//
// The engine runs every hour, around the clock. Each lane only fires inside its
// best window (Central time) and never sends more than the open schedule can
// absorb: daily budget = min(lane cap, open slots in the next 5 days x sends per slot).

export type Lane = "reactivation" | "cold_kitchen" | "cold_office" | "inbound_followup";

// weekday: 0=Sun..6=Sat; hours are the start hour of each hourly run that may send.
export const LANE_WINDOWS: Record<Lane, { days: number[]; hours: number[] }> = {
  // Past customers: mid-morning, mid-week, when people read business email.
  reactivation: { days: [2, 3, 4], hours: [9, 10] },
  // Restaurants, kitchens, ice/walk-in owners: the lull between lunch and dinner rush.
  cold_kitchen: { days: [1, 2, 3, 4], hours: [14, 15] },
  // Offices, property managers, retail, medical: early business hours.
  cold_office: { days: [2, 3, 4], hours: [8, 9, 10] },
  // Nudges to inbound leads who haven't booked yet: daytime, every day.
  inbound_followup: { days: [0, 1, 2, 3, 4, 5, 6], hours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] },
};

export const KITCHEN_SERVICE_LINES = new Set(["refrigeration", "ice_machine", "kitchen_equipment", "exhaust_hood", "multiple"]);

export function laneForServiceLine(serviceLine: string | null | undefined): "cold_kitchen" | "cold_office" {
  return KITCHEN_SERVICE_LINES.has(String(serviceLine ?? "")) ? "cold_kitchen" : "cold_office";
}

export function laneIsOpen(lane: Lane, weekday: number, hour: number) {
  const w = LANE_WINDOWS[lane];
  return w.days.includes(weekday) && w.hours.includes(hour);
}

/** Runs left today for this lane, counting the current hour. */
export function runsLeftToday(lane: Lane, hour: number) {
  return LANE_WINDOWS[lane].hours.filter((h) => h >= hour).length;
}

/**
 * How many messages this run may send for a lane.
 * openSlots: free crew slots in the next 5 days. sentToday: this lane's sends so far today.
 */
export function batchSize(opts: { lane: Lane; weekday: number; hour: number; openSlots: number; sendsPerSlot: number; dailyCap: number; sentToday: number }) {
  if (!laneIsOpen(opts.lane, opts.weekday, opts.hour)) return 0;
  const budget = Math.min(Math.max(0, opts.dailyCap), Math.max(0, opts.openSlots) * Math.max(1, opts.sendsPerSlot));
  const remaining = budget - Math.max(0, opts.sentToday);
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / Math.max(1, runsLeftToday(opts.lane, opts.hour)));
}

/** Cold sequence: step 0 now, step 1 after 3 days, step 2 after 7 days, then done. */
export const COLD_STEP_GAP_DAYS = [0, 3, 4];
export const COLD_MAX_STEPS = 3;

export function coldStepDue(step: number, lastAt: string | null, now = new Date()) {
  if (step >= COLD_MAX_STEPS) return false;
  if (step === 0 || !lastAt) return true;
  const gapMs = COLD_STEP_GAP_DAYS[step] * 24 * 60 * 60 * 1000;
  return now.getTime() - new Date(lastAt).getTime() >= gapMs;
}

/** Inbound nudges if not booked: ~2 hours, ~1 day, ~3 days after the first reply. */
export const INBOUND_NUDGE_AFTER_HOURS = [2, 24, 72];

export function inboundNudgeDue(touchCount: number, firstReplyAt: string | null, now = new Date()) {
  if (!firstReplyAt) return false;
  const nudgeIndex = touchCount - 1; // touch 1 was the instant reply
  if (nudgeIndex < 0 || nudgeIndex >= INBOUND_NUDGE_AFTER_HOURS.length) return false;
  const elapsedHours = (now.getTime() - new Date(firstReplyAt).getTime()) / 3_600_000;
  return elapsedHours >= INBOUND_NUDGE_AFTER_HOURS[nudgeIndex];
}

/** Customers are due for a check-in when their last outreach was 90+ days ago (or never). */
export const REACTIVATION_GAP_DAYS = 90;
