import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { getActiveTechnicians, getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createScheduledJobAction, rescheduleJobAction } from "./actions";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ week?: string; success?: string; error?: string }> };
const field = "min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 py-2 text-sm text-white";
const TIMES = Array.from({ length: 27 }, (_, i) => {
  const total = 7 * 60 + i * 30;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
});

function ctToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function validDate(value?: string) { return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)); }
function dateAt(value: string) { return new Date(`${value}T12:00:00Z`); }
function ymd(date: Date) { return date.toISOString().slice(0, 10); }
function mondayOf(value: string) {
  const d = dateAt(value);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return ymd(d);
}
function shift(value: string, days: number) { const d = dateAt(value); d.setUTCDate(d.getUTCDate() + days); return ymd(d); }
function labelDate(value: string) { return dateAt(value).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }); }
function displayTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  const d = new Date(Date.UTC(2026, 0, 1, h, m));
  return d.toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" });
}
function parseWindow(value: string | null) {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})-(\d{2}:\d{2}) CT$/);
  return match ? { date: match[1], start: match[2], end: match[3] } : null;
}

export default async function SchedulePage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const params = await searchParams;
  const weekStart = mondayOf(validDate(params.week) ? params.week! : ctToday());
  const days = Array.from({ length: 7 }, (_, i) => shift(weekStart, i));
  const [customers, technicians, jobs] = await Promise.all([getCustomers(), getActiveTechnicians(), getDispatchJobs(250)]);
  const active = jobs.filter((job) => ["scheduled", "in_progress"].includes(job.status));
  const parsed = active.map((job) => ({ job, slot: parseWindow(job.scheduledWindow) }));
  const scheduledThisWeek = parsed.filter((entry) => entry.slot && days.includes(entry.slot.date));
  const unscheduled = parsed.filter((entry) => !entry.slot);
  const previousWeek = shift(weekStart, -7);
  const nextWeek = shift(weekStart, 7);

  return <AppShell title="Scheduling" description="Weekly job scheduling by technician and time of day. One calendar, tied directly to Dispatch.">
    <div className="space-y-5">
      <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Week of {labelDate(weekStart)}</p><p className="mt-1 text-sm text-zinc-400">{scheduledThisWeek.length} scheduled this week · {unscheduled.length} legacy / unscheduled active calls</p></div>
          <div className="flex gap-2"><Link href={`/schedule?week=${previousWeek}`} className="rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-sm text-[#d9fbff]">Previous</Link><Link href="/schedule" className="rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-sm text-[#d9fbff]">This week</Link><Link href={`/schedule?week=${nextWeek}`} className="rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-sm text-[#d9fbff]">Next</Link></div>
        </div>
        {params.success ? <p className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{params.success}</p> : null}
        {params.error ? <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{params.error}</p> : null}
      </section>

      <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
        <div className="mb-4"><h2 className="text-xl font-semibold text-white">Schedule a job</h2><p className="mt-1 text-sm text-zinc-400">Customer, technician, date, and time. That is the whole ritual.</p></div>
        <form action={createScheduledJobAction} className="grid gap-3 lg:grid-cols-4">
          <input type="hidden" name="week" value={weekStart} />
          <select required name="customerId" defaultValue="" className={field}><option value="">Customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select>
          <select name="assignedTechId" defaultValue="" className={field}><option value="">Unassigned technician</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}</option>)}</select>
          <input required name="date" type="date" defaultValue={weekStart} className={field} />
          <div className="grid grid-cols-2 gap-2"><select required name="start" defaultValue="09:00" className={field}>{TIMES.map((time) => <option key={time} value={time}>{displayTime(time)}</option>)}</select><select required name="end" defaultValue="11:00" className={field}>{TIMES.map((time) => <option key={time} value={time}>{displayTime(time)}</option>)}</select></div>
          <input name="location" placeholder="Service location" className={`${field} lg:col-span-2`} />
          <input required name="scope" placeholder="Job / complaint / scope" className={`${field} lg:col-span-2`} />
          <button type="submit" className="min-h-12 rounded-xl border border-[#8ffafa]/55 bg-[#2d7dff]/20 px-4 py-2 font-semibold text-white lg:col-span-4">Schedule Job</button>
        </form>
      </section>

      <section className="overflow-x-auto rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-3">
        <div className="grid min-w-[1050px] grid-cols-7 gap-2">
          {days.map((day) => {
            const dayJobs = scheduledThisWeek.filter((entry) => entry.slot?.date === day).sort((a, b) => (a.slot?.start ?? "").localeCompare(b.slot?.start ?? ""));
            return <div key={day} className="min-h-[420px] rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/65 p-2.5">
              <div className="mb-3 border-b border-[#2d7dff]/15 pb-2"><p className="text-sm font-semibold text-white">{labelDate(day)}</p><p className="text-xs text-zinc-500">{dayJobs.length} job{dayJobs.length === 1 ? "" : "s"}</p></div>
              <div className="space-y-2">{dayJobs.length === 0 ? <p className="rounded-xl border border-dashed border-[#2d7dff]/15 p-3 text-xs text-zinc-600">Open</p> : dayJobs.map(({ job, slot }) => <article key={job.id} className="rounded-xl border border-[#2d7dff]/20 bg-black/55 p-3">
                <p className="text-xs font-semibold text-[#8ffafa]">{displayTime(slot!.start)}–{displayTime(slot!.end)}</p>
                <p className="mt-1 text-sm font-semibold text-white">{job.customerName}</p>
                <p className="mt-1 text-xs text-zinc-400">{job.assignedTechName ?? "Unassigned"}</p>
                {job.location ? <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{job.location}</p> : null}
                {job.scope ? <p className="mt-1 line-clamp-3 text-xs text-zinc-500">{job.scope}</p> : null}
                <div className="mt-2"><StatusPill tone={job.status === "in_progress" ? "emerald" : undefined}>{job.status.replace(/_/g, " ")}</StatusPill></div>
                <details className="mt-2"><summary className="cursor-pointer text-xs text-[#d9fbff]">Reschedule</summary><form action={rescheduleJobAction} className="mt-2 space-y-2"><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="week" value={weekStart} /><input name="date" type="date" defaultValue={slot!.date} className={field} /><div className="grid grid-cols-2 gap-1"><select name="start" defaultValue={slot!.start} className={field}>{TIMES.map((time) => <option key={time} value={time}>{displayTime(time)}</option>)}</select><select name="end" defaultValue={slot!.end} className={field}>{TIMES.map((time) => <option key={time} value={time}>{displayTime(time)}</option>)}</select></div><select name="assignedTechId" defaultValue={job.assignedTechId ?? ""} className={field}><option value="">Unassigned</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}</option>)}</select><button className="w-full rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-white">Save schedule</button></form></details>
              </article>)}</div>
            </div>;
          })}
        </div>
      </section>

      {unscheduled.length ? <section className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.04] p-4"><h2 className="text-lg font-semibold text-white">Needs scheduling cleanup</h2><p className="mt-1 text-sm text-zinc-400">These active calls were created before the standardized calendar format. Put them on the weekly board once and they will stay organized.</p><div className="mt-3 grid gap-2 md:grid-cols-2">{unscheduled.map(({ job }) => <article key={job.id} className="rounded-xl border border-amber-400/15 bg-black/45 p-3"><p className="font-semibold text-white">{job.customerName}</p><p className="mt-1 text-xs text-zinc-500">{job.scheduledWindow || "No schedule"} · {job.assignedTechName ?? "Unassigned"}</p><details className="mt-2"><summary className="cursor-pointer text-xs text-amber-100">Put on calendar</summary><form action={rescheduleJobAction} className="mt-2 grid gap-2 sm:grid-cols-2"><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="week" value={weekStart} /><input name="date" type="date" defaultValue={weekStart} className={field} /><select name="assignedTechId" defaultValue={job.assignedTechId ?? ""} className={field}><option value="">Unassigned</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}</option>)}</select><select name="start" defaultValue="09:00" className={field}>{TIMES.map((time) => <option key={time} value={time}>{displayTime(time)}</option>)}</select><select name="end" defaultValue="11:00" className={field}>{TIMES.map((time) => <option key={time} value={time}>{displayTime(time)}</option>)}</select><button className="rounded-xl border border-amber-400/25 px-3 py-2 text-xs text-amber-100 sm:col-span-2">Add to week</button></form></details></article>)}</div></section> : null}
    </div>
  </AppShell>;
}
