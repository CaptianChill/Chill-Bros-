// Helpers for the "YYYY-MM-DD HH:MM-HH:MM CT" scheduled_window format that
// the schedule, Home and Dispatch screens all read.

const TIME_ZONE = "America/Chicago";

/** Today's date in Central time as YYYY-MM-DD. */
export function ctToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

/** The YYYY-MM-DD date `days` after `date`. */
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function parseWindow(value: string | null) {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})-(\d{2}:\d{2}) CT$/);
  return match ? { date: match[1], start: match[2], end: match[3] } : null;
}

/** "13:30" -> "1:30 PM" */
export function displayTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  return new Date(Date.UTC(2026, 0, 1, h, m)).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" });
}

/** "2026-09-23" -> { weekday: "Wed", day: "23", label: "Wednesday, September 23" } */
export function dayParts(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" }),
    day: d.toLocaleDateString("en-US", { timeZone: "UTC", day: "numeric" }),
    label: d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }),
  };
}
