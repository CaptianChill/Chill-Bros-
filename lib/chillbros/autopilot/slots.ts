// Open booking slots from real capacity. Pure functions (no imports) so the
// slot math is unit-tested directly: scripts/lead-autopilot.test.cjs.
//
// A slot is open when fewer jobs overlap it than the crew can run at once.
// Jobs count only when their scheduled_window uses the canonical
// "YYYY-MM-DD HH:MM-HH:MM CT" format the schedule screens write.

export type SlotSettings = {
  workday_start: string; // "08:00"
  workday_end: string; // "17:00"
  saturday_start: string | null;
  saturday_end: string | null;
  slot_minutes: number;
  jobs_per_slot: number | null;
  booking_days_ahead: number;
  min_lead_hours: number;
};

export type BusyJob = { scheduled_window: string | null; status: string | null; archived_at?: string | null };

export type OpenSlot = { date: string; start: string; end: string; window: string; free: number };

const TZ = "America/Chicago";
const IGNORED_STATUSES = new Set(["cancelled"]);

export function toMinutes(hhmm: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function fromMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function windowLabel(date: string, start: string, end: string) {
  return `${date} ${start}-${end} CT`;
}

export function parseCanonicalWindow(value: string | null | undefined) {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})-(\d{2}:\d{2}) CT$/.exec(String(value ?? "").trim());
  if (!m) return null;
  return { date: m[1], start: toMinutes(m[2]), end: toMinutes(m[3]) };
}

/** Central-time date (YYYY-MM-DD), minutes after midnight, and weekday (0=Sun). */
export function centralNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), weekday, hour: Number(parts.hour) };
}

export function addDaysIso(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** Every open slot from today through booking_days_ahead, earliest first. */
export function computeOpenSlots(settings: SlotSettings, jobs: BusyJob[], activeTechs: number, now = new Date()): OpenSlot[] {
  const capacity = Math.max(1, settings.jobs_per_slot ?? activeTechs ?? 1);
  const slotLen = Math.max(30, settings.slot_minutes || 120);
  const today = centralNow(now);
  const earliestToday = today.minutes + Math.max(0, settings.min_lead_hours) * 60;
  // Lead time that runs past midnight pushes the cutoff into tomorrow.
  const cutoffDate = earliestToday >= 1440 ? addDaysIso(today.date, Math.floor(earliestToday / 1440)) : today.date;
  const cutoffMinutes = earliestToday % 1440;

  const busy = new Map<string, Array<{ start: number; end: number }>>();
  for (const job of jobs) {
    if (job.archived_at || IGNORED_STATUSES.has(String(job.status ?? ""))) continue;
    const w = parseCanonicalWindow(job.scheduled_window);
    if (!w || !(w.end > w.start)) continue;
    const list = busy.get(w.date) ?? [];
    list.push({ start: w.start, end: w.end });
    busy.set(w.date, list);
  }

  const slots: OpenSlot[] = [];
  for (let i = 0; i <= settings.booking_days_ahead; i++) {
    const date = addDaysIso(today.date, i);
    const dow = weekdayOf(date);
    let startStr: string | null = null;
    let endStr: string | null = null;
    if (dow >= 1 && dow <= 5) { startStr = settings.workday_start; endStr = settings.workday_end; }
    else if (dow === 6 && settings.saturday_start && settings.saturday_end) { startStr = settings.saturday_start; endStr = settings.saturday_end; }
    if (!startStr || !endStr) continue;
    const dayStart = toMinutes(startStr);
    const dayEnd = toMinutes(endStr);
    if (!(dayEnd > dayStart)) continue;

    for (let s = dayStart; s + slotLen <= dayEnd; s += slotLen) {
      if (date < cutoffDate || (date === cutoffDate && s < cutoffMinutes)) continue;
      const e = s + slotLen;
      const overlapping = (busy.get(date) ?? []).filter((b) => b.start < e && b.end > s).length;
      const free = capacity - overlapping;
      if (free > 0) {
        const start = fromMinutes(s);
        const end = fromMinutes(e);
        slots.push({ date, start, end, window: windowLabel(date, start, end), free });
      }
    }
  }
  return slots;
}

/** Open slots in the next `days` days — the outreach throttle's supply number. */
export function openSlotCount(slots: OpenSlot[], fromDate: string, days: number) {
  const last = addDaysIso(fromDate, days);
  return slots.filter((s) => s.date <= last).reduce((n, s) => n + s.free, 0);
}
