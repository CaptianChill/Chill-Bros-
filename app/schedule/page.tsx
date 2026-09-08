import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { getActiveTechnicians, getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createScheduledJobAction, createTeamMeetingAction, rescheduleJobAction } from "./actions";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ week?: string; success?: string; error?: string }> };
const field = "min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 py-2 text-sm text-white";
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

export default async function SchedulePage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager","office"].includes(profile.role)) redirect("/");
  const params = await searchParams;
  const weekStart = mondayOf(validDate(params.week) ? params.week! : ctToday());
  const days = Array.from({ length:7 },(_,i)=>shift(weekStart,i));
  const [customers,technicians,jobs] = await Promise.all([getCustomers(),getActiveTechnicians(),getDispatchJobs(250)]);
  const parsed = jobs.filter((job)=>["scheduled","in_progress"].includes(job.status)).map((job)=>({job,slot:parseWindow(job.scheduledWindow)}));
  const scheduledThisWeek = parsed.filter((entry)=>entry.slot && days.includes(entry.slot.date));
  const previousWeek = shift(weekStart,-7), nextWeek = shift(weekStart,7);

  return <AppShell title="Scheduling" description="Service calls and team meetings in one simple weekly calendar.">
    <div className="space-y-4">
      <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Week of {labelDate(weekStart)}</p><p className="mt-1 text-sm text-zinc-400">{scheduledThisWeek.length} scheduled item{scheduledThisWeek.length===1?"":"s"}</p></div><div className="flex gap-2"><Link href={`/schedule?week=${previousWeek}`} className="rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-sm text-[#d9fbff]">Previous</Link><Link href="/schedule" className="rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-sm text-[#d9fbff]">This week</Link><Link href={`/schedule?week=${nextWeek}`} className="rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-sm text-[#d9fbff]">Next</Link></div></div>
        {params.success ? <p className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{params.success}</p> : null}
        {params.error ? <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{params.error}</p> : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-3xl border border-[#8ffafa]/30 bg-[#06111b]/90 p-4"><h2 className="text-lg font-semibold text-white">Schedule service call</h2><p className="mt-1 text-sm text-zinc-400">Customer, technician, date and time.</p><form action={createScheduledJobAction} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="week" value={weekStart}/><select required name="customerId" defaultValue="" className={field}><option value="">Customer</option>{customers.filter(c=>c.name!=="Chill Pros Team").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select name="assignedTechId" defaultValue="" className={field}><option value="">Unassigned technician</option>{technicians.map(t=><option key={t.id} value={t.id}>{t.fullName}</option>)}</select><input required name="date" type="date" defaultValue={weekStart} className={field}/><div className="grid grid-cols-2 gap-2"><select required name="start" defaultValue="09:00" className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select><select required name="end" defaultValue="11:00" className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select></div><input name="location" placeholder="Service location" className={field}/><input required name="scope" placeholder="Complaint / scope" className={field}/><button className="min-h-12 rounded-xl border border-[#8ffafa]/55 bg-[#2d7dff]/20 px-4 py-2 font-semibold text-white sm:col-span-2">Schedule Call</button></form></section>

        <section className="rounded-3xl border border-violet-400/30 bg-violet-500/[0.05] p-4"><h2 className="text-lg font-semibold text-white">Schedule team meeting</h2><p className="mt-1 text-sm text-zinc-400">Office, technicians, or whole-team time without creating customer paperwork.</p><form action={createTeamMeetingAction} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="week" value={weekStart}/><input required name="title" placeholder="Meeting title" className={`${field} sm:col-span-2`}/><input required name="date" type="date" defaultValue={weekStart} className={field}/><div className="grid grid-cols-2 gap-2"><select required name="start" defaultValue="10:00" className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select><select required name="end" defaultValue="10:30" className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select></div><input name="location" placeholder="Office / phone / video" className={field}/><input name="attendees" placeholder="Whole team or names" className={field}/><button className="min-h-12 rounded-xl border border-violet-300/40 bg-violet-500/10 px-4 py-2 font-semibold text-white sm:col-span-2">Schedule Meeting</button></form></section>
      </div>

      <section className="overflow-x-auto rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-3"><div className="grid min-w-[1050px] grid-cols-7 gap-2">{days.map(day=>{ const dayJobs=scheduledThisWeek.filter(e=>e.slot?.date===day).sort((a,b)=>(a.slot?.start??"").localeCompare(b.slot?.start??"")); return <div key={day} className="min-h-[360px] rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/65 p-2.5"><div className="mb-3 border-b border-[#2d7dff]/15 pb-2"><p className="text-sm font-semibold text-white">{labelDate(day)}</p><p className="text-xs text-zinc-500">{dayJobs.length} scheduled</p></div><div className="space-y-2">{dayJobs.length===0?<p className="rounded-xl border border-dashed border-[#2d7dff]/15 p-3 text-xs text-zinc-600">Open</p>:dayJobs.map(({job,slot})=>{ const meeting=isMeeting(job.scope); return <article key={job.id} className={`rounded-xl border p-3 ${meeting?"border-violet-400/30 bg-violet-500/[0.06]":"border-[#2d7dff]/20 bg-black/55"}`}><p className="text-xs font-semibold text-[#8ffafa]">{displayTime(slot!.start)}–{displayTime(slot!.end)}</p><p className="mt-1 text-sm font-semibold text-white">{meeting?meetingTitle(job.scope):job.customerName}</p><p className="mt-1 text-xs text-zinc-400">{meeting?"Team meeting":job.assignedTechName??"Unassigned"}</p>{job.location?<p className="mt-1 text-xs text-zinc-500">{job.location}</p>:null}{!meeting&&job.scope?<p className="mt-1 line-clamp-2 text-xs text-zinc-500">{job.scope}</p>:null}<div className="mt-2"><StatusPill tone={meeting?undefined:job.status==="in_progress"?"emerald":undefined}>{meeting?"meeting":job.status.replace(/_/g," ")}</StatusPill></div><details className="mt-2"><summary className="cursor-pointer text-xs text-[#d9fbff]">Reschedule</summary><form action={rescheduleJobAction} className="mt-2 space-y-2"><input type="hidden" name="jobId" value={job.id}/><input type="hidden" name="week" value={weekStart}/><input name="date" type="date" defaultValue={slot!.date} className={field}/><div className="grid grid-cols-2 gap-1"><select name="start" defaultValue={slot!.start} className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select><select name="end" defaultValue={slot!.end} className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select></div>{!meeting?<select name="assignedTechId" defaultValue={job.assignedTechId??""} className={field}><option value="">Unassigned</option>{technicians.map(t=><option key={t.id} value={t.id}>{t.fullName}</option>)}</select>:<input type="hidden" name="assignedTechId" value=""/>}<button className="w-full rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-white">Save</button></form></details></article>})}</div></div>})}</div></section>
    </div>
  </AppShell>;
}
