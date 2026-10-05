import { rejectUnlessBrae, noStore } from "@/lib/brae/auth";
import { getCalendarJobs } from "@/lib/chillbros/schedule-queries";
import { addDays, ctToday, displayTime, parseWindow } from "@/lib/chillbros/schedule-window";
import { JOB_STATUS_LABELS } from "@/lib/chillbros/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/brae/today?date=YYYY-MM-DD&days=1
 * Scheduled jobs for a day (Central time). Defaults to today. Read-only.
 */
export async function GET(request: Request) {
  const denied = rejectUnlessBrae(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const requested = url.searchParams.get("date") || "";
  const start = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : ctToday();
  const days = Math.max(1, Math.min(7, Number(url.searchParams.get("days") || 1) || 1));
  const end = addDays(start, days - 1);

  const jobs = await getCalendarJobs();
  const rows = jobs
    .map((job) => ({ job, window: parseWindow(job.scheduledWindow) }))
    .filter(({ window }) => window && window.date >= start && window.date <= end)
    .sort((x, y) => `${x.window!.date} ${x.window!.start}`.localeCompare(`${y.window!.date} ${y.window!.start}`))
    .map(({ job, window }) => ({
      jobId: job.id,
      date: window!.date,
      time: `${displayTime(window!.start)}–${displayTime(window!.end)}`,
      customer: job.customerName,
      technician: job.assignedTechName ?? "Unassigned",
      status: JOB_STATUS_LABELS[job.status] ?? job.status,
      location: job.location,
      scope: job.scope,
    }));

  return Response.json({ ok: true, from: start, to: end, count: rows.length, jobs: rows }, noStore);
}
