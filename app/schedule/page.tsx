import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ScheduleDeleteButton } from "@/components/schedule-delete-button";
import { getActiveTechnicians } from "@/lib/chillbros/operations-queries";
import { getCalendarJobs } from "@/lib/chillbros/schedule-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createScheduledJobAction, createTeamMeetingAction, rescheduleJobAction } from "./actions";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ week?: string; success?: string; error?: string }> };
const field = "min-h-10 w-full rounded-lg border border-[#2d7dff]/25 bg-black px-3 py-2 text-sm text-white";
const TIMES = Array.from({ length: 27 }, (_, i) => { const total = 7 * 60 + i * 30; return `${String(Math.floor(total / 60)).padStart(2,"0")}:${String(total % 60).padStart(2,"0")}`; });
function ctToday() { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const map = Object.fromEntries(parts.map((p) => [p.type,p.value])); return `${map.year}-${map.month}-${map.day}`; }
function validDate(value?: string) { return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)); }
function dateAt(value: string) { return new Date(`${value}T12:00:00Z`); }
function ymd(date: Date) { return date.toISOString().slice(0,10); }
function mondayOf(value: string) { const d = dateAt(value); const day = d.getUTCDay(); d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1)); return ymd(d); }
function shift(value: string, days: number) { const d = dateAt(value); d.setUTCDate(d.getUTCDate()+days); return ymd(d); }
function labelDate(value: string) { return dateAt(value).toLocaleDateString("en-US", { timeZone:"UTC", weekday:"short", month:"short", day:"numeric" }); }
function displayTime(value: string) { const [h,m] = value.split(":").map(Number); return new Date(Date.UTC(2026,0,1,h,m)).toLocaleTimeString("en-US", { timeZone:"UTC", hour:"numeric", minute:"2-digit" }); }
function parseWindow(value: string | null) { const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})-(\d{2}:\d{2}) CT$/); return match ? { date:match[1], start:match[2], end:match[3] } : null; }
function isMeeting(scope: string | null) { return String(scope ?? "").startsWith("[TEAM MEETING]"); }
function meetingTitle(scope: string | null) { return String(scope ?? "").replace(/^\[TEAM MEETING\]\s*/,"").split(" | Attendees:")[0]; }
function uniqueCustomers<T extends { name: string }>(rows: T[]) { const seen = new Set<string>(); return rows.filter((row) => { const key = row.name.trim().toLowerCase().replace(/\s+/g," "); if (seen.has(key)) return false; seen.add(key); return true; }); }

export default async function SchedulePage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager","office"].includes(profile.role)) redirect("/");
  const params = await searchParams;
  const today = ctToday();
  const weekStart = mondayOf(validDate(params.week) ? params.week! : today);
  const days = Array.from({ length:7 },(_,i)=>shift(weekStart,i));
  const defaultDate = days.includes(today) ? today : weekStart;
  const [rawCustomers,technicians,jobs] = await Promise.all([getCustomers(),getActiveTechnicians(),getCalendarJobs()]);
  const customers = uniqueCustomers(rawCustomers.filter((c)=>c.name!=="Chill Pros Team"));
  const parsed = jobs.map((job)=>({job,slot:parseWindow(job.scheduledWindow)}));
  const scheduledThisWeek = parsed.filter((entry)=>entry.slot && days.includes(entry.slot.date));
  const previousWeek = shift(weekStart,-7), nextWeek = shift(weekStart,7);

  return <AppShell title="Scheduling">
    <div className="space-y-3">
      <section className="rounded-2xl border border-[#2d7dff]/25 bg-black/45 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8ffafa]">Week of {labelDate(weekStart)}</p><p className="text-xs text-zinc-500">{scheduledThisWeek.length} scheduled</p></div>
          <div className="flex gap-2"><Link href={`/schedule?week=${previousWeek}`} className="rounded-lg border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff]">Previous</Link><Link href="/schedule" className="rounded-lg border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff]">This week</Link><Link href={`/schedule?week=${nextWeek}`} className="rounded-lg border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff]">Next</Link></div>
        </div>
        {params.success ? <p className="mt-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{params.success}</p> : null}
        {params.error ? <p className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{params.error}</p> : null}
      </section>

      <div className="grid gap-2 lg:grid-cols-2">
        <details className="group rounded-xl border border-[#8ffafa]/30 bg-[#06111b]/90 p-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-white">Schedule service call <span className="ml-2 text-xs font-normal text-zinc-500">tap to expand</span></summary>
          <form action={createScheduledJobAction} className="mt-3 grid gap-2 sm:grid-cols-2"><input type="hidden" name="week" value={weekStart}/><select required name="customerId" defaultValue="" className={field}><option value="">Customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select name="assignedTechId" defaultValue="" className={field}><option value="">Unassigned technician</option>{technicians.map(t=><option key={t.id} value={t.id}>{t.fullName}</option>)}</select><input required name="date" type="date" defaultValue={defaultDate} className={field}/><div className="grid grid-cols-2 gap-2"><select required name="start" defaultValue="09:00" className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select><select required name="end" defaultValue="11:00" className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select></div><input name="location" placeholder="Service location" className={field}/><input required name="scope" placeholder="Complaint / scope" className={field}/><button type="submit" className="min-h-10 rounded-lg border border-[#8ffafa]/55 bg-[#2d7dff]/20 px-4 py-2 text-sm font-semibold text-white sm:col-span-2">Save Call</button></form>
        </details>

        <details className="group rounded-xl border border-violet-400/30 bg-violet-500/[0.05] p-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-white">Schedule team meeting <span className="ml-2 text-xs font-normal text-zinc-500">tap to expand</span></summary>
          <form action={createTeamMeetingAction} className="mt-3 grid gap-2 sm:grid-cols-2"><input type="hidden" name="week" value={weekStart}/><input required name="title" placeholder="Meeting title" className={`${field} sm:col-span-2`}/><input required name="date" type="date" defaultValue={defaultDate} className={field}/><div className="grid grid-cols-2 gap-2"><select required name="start" defaultValue="10:00" className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select><select required name="end" defaultValue="10:30" className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select></div><input name="location" placeholder="Office / phone / video" className={field}/><input name="attendees" placeholder="Whole team or names" className={field}/><button type="submit" className="min-h-10 rounded-lg border border-violet-300/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-white sm:col-span-2">Save Meeting</button></form>
        </details>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-[#2d7dff]/25 bg-black/45 p-2">
        <div className="grid min-w-[900px] grid-cols-7 gap-1.5">{days.map(day=>{ const dayJobs=scheduledThisWeek.filter(e=>e.slot?.date===day).sort((a,b)=>(a.slot?.start??"").localeCompare(b.slot?.start??"")); return <div key={day} className="min-h-[180px] rounded-lg border border-[#2d7dff]/15 bg-zinc-950/65 p-1.5"><div className="mb-1.5 border-b border-[#2d7dff]/15 pb-1.5"><p className="text-[11px] font-semibold text-white">{labelDate(day)}</p><p className="text-[9px] text-zinc-500">{dayJobs.length} scheduled</p></div><div className="space-y-1">{dayJobs.length===0?<p className="rounded-md border border-dashed border-[#2d7dff]/15 p-1.5 text-[10px] text-zinc-600">Open</p>:dayJobs.map(({job,slot})=>{ const meeting=isMeeting(job.scope); return <article key={job.id} className={`rounded-md border p-1.5 ${meeting?"border-violet-400/30 bg-violet-500/[0.06]":"border-[#2d7dff]/20 bg-black/55"}`}><p className="text-[10px] font-semibold text-[#8ffafa]">{displayTime(slot!.start)}–{displayTime(slot!.end)}</p><p className="truncate text-[11px] font-semibold text-white">{meeting?meetingTitle(job.scope):job.customerName}</p><p className="truncate text-[9px] text-zinc-400">{job.location || "No location"}</p><p className="truncate text-[9px] text-zinc-500">{meeting?"Team meeting":job.assignedTechName??"Unassigned"}</p><div className="mt-1.5 grid grid-cols-2 gap-1.5"><details className="relative z-10 min-w-0 rounded-lg border border-[#2d7dff]/25 bg-black/30"><summary className="cursor-pointer list-none px-2 py-2 text-center text-[11px] font-semibold text-[#d9fbff]">Edit</summary><form action={rescheduleJobAction} className="absolute left-0 top-full z-30 mt-1 w-[260px] space-y-1.5 rounded-xl border border-[#2d7dff]/30 bg-[#03070d] p-2 shadow-2xl"><input type="hidden" name="jobId" value={job.id}/><input type="hidden" name="week" value={weekStart}/><input name="date" type="date" defaultValue={slot!.date} className={field}/><div className="grid grid-cols-2 gap-1"><select name="start" defaultValue={slot!.start} className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select><select name="end" defaultValue={slot!.end} className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select></div>{!meeting?<select name="assignedTechId" defaultValue={job.assignedTechId??""} className={field}><option value="">Unassigned</option>{technicians.map(t=><option key={t.id} value={t.id}>{t.fullName}</option>)}</select>:<input type="hidden" name="assignedTechId" value=""/>}<button type="submit" className="w-full rounded-lg border border-[#2d7dff]/30 px-3 py-2 text-[11px] text-white">Save</button></form></details><ScheduleDeleteButton jobId={job.id} week={weekStart}/></div>{!meeting?<Link href={`/jobs/${job.id}`} className="mt-1 block text-[9px] text-zinc-500 underline underline-offset-2">Open call</Link>:null}</article>})}</div></div>})}</div>
      </section>
    </div>
  </AppShell>;
}
