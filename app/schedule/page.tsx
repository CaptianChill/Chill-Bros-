import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ScheduleDeleteButton } from "@/components/schedule-delete-button";
import { ScheduleSubmitButton } from "@/components/schedule-submit-button";
import { getActiveTechnicians } from "@/lib/chillbros/operations-queries";
import { getCalendarJobs } from "@/lib/chillbros/schedule-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createScheduledJobAction, createTeamMeetingAction, rescheduleJobAction } from "./actions";
import { createScheduleCustomerAction } from "./customer-actions";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ week?: string; success?: string; error?: string; customer?: string }> };
const field = "box min-h-10 w-full rounded-lg bg-black px-3 py-2 text-center text-sm text-white";
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
  const selectedCustomer = customers.some((customer)=>customer.id===params.customer) ? params.customer : "";
  const parsed = jobs.map((job)=>({job,slot:parseWindow(job.scheduledWindow)}));
  const scheduledThisWeek = parsed.filter((entry)=>entry.slot && days.includes(entry.slot.date));
  const previousWeek = shift(weekStart,-7), nextWeek = shift(weekStart,7);

  return <AppShell title="Scheduling">
    <div className="space-y-3 text-center">
      <section className="panel rounded-2xl p-3">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-between">
          <div className="text-center"><p className="glo text-xs font-semibold uppercase tracking-[0.16em]">Week of {labelDate(weekStart)}</p><p className="sub text-xs">{scheduledThisWeek.length} scheduled</p></div>
          <div className="flex justify-center gap-2"><Link href={`/schedule?week=${previousWeek}`} className="box rounded-lg px-3 py-2 text-center text-xs text-white">Previous</Link><Link href="/schedule" className="box hot rounded-lg px-3 py-2 text-center text-xs text-white">This week</Link><Link href={`/schedule?week=${nextWeek}`} className="box rounded-lg px-3 py-2 text-center text-xs text-white">Next</Link></div>
        </div>
        {params.success ? <p className="box txt mt-2 rounded-lg px-3 py-2 text-center text-xs">{params.success}</p> : null}
        {params.error ? <p className="danger-box txt mt-2 rounded-lg px-3 py-2 text-center text-xs">{params.error}</p> : null}
      </section>

      <div className="grid gap-2 sm:grid-cols-3">
        <details className="panel group rounded-xl p-2 open:sm:col-span-3 sm:p-3">
          <summary className="glo cursor-pointer list-none text-center text-sm font-semibold">Schedule service call <span className="sub ml-1 text-[10px] font-normal sm:text-xs">tap to expand</span></summary>
          <form action={createScheduledJobAction} className="mt-3 grid gap-2 sm:grid-cols-2" noValidate><input type="hidden" name="week" value={weekStart}/><select required name="customerId" defaultValue={selectedCustomer} className={field}><option value="">Customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select name="assignedTechId" defaultValue="" className={field}><option value="">Unassigned technician</option>{technicians.map(t=><option key={t.id} value={t.id}>{t.fullName}</option>)}</select><input required name="date" type="date" defaultValue={defaultDate} className={field}/><div className="grid grid-cols-2 gap-2"><select required name="start" defaultValue="09:00" className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select><select required name="end" defaultValue="11:00" className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select></div><input name="location" placeholder="Service location" className={field}/><input name="scope" placeholder="Complaint / scope" className={field}/><ScheduleSubmitButton label="Save Call" /></form>
        </details>

        <details className="panel group rounded-xl p-2 open:sm:col-span-3 sm:p-3">
          <summary className="glo cursor-pointer list-none text-center text-sm font-semibold">Add customer <span className="sub ml-1 text-[10px] font-normal sm:text-xs">new client</span></summary>
          <form action={createScheduleCustomerAction} className="mt-3 grid gap-2 sm:grid-cols-2" noValidate><input type="hidden" name="week" value={weekStart}/><input required name="name" placeholder="Customer / business name" className={field}/><input name="phone" type="tel" placeholder="Phone" className={field}/><input name="email" type="email" placeholder="Email" className={field}/><input name="address" placeholder="Service / billing address" className={field}/><button type="submit" className="box hot min-h-11 rounded-lg px-4 py-2 text-center text-sm font-semibold text-white sm:col-span-2">Add Customer</button></form>
        </details>

        <details className="panel group rounded-xl p-2 open:sm:col-span-3 sm:p-3">
          <summary className="glo cursor-pointer list-none text-center text-sm font-semibold">Schedule team meeting <span className="sub ml-1 text-[10px] font-normal sm:text-xs">tap to expand</span></summary>
          <form action={createTeamMeetingAction} className="mt-3 grid gap-2 sm:grid-cols-2" noValidate><input type="hidden" name="week" value={weekStart}/><input required name="title" placeholder="Meeting title" className={`${field} sm:col-span-2`}/><input required name="date" type="date" defaultValue={defaultDate} className={field}/><div className="grid grid-cols-2 gap-2"><select required name="start" defaultValue="10:00" className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select><select required name="end" defaultValue="10:30" className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select></div><input name="location" placeholder="Office / phone / video" className={field}/><input name="attendees" placeholder="Whole team or names" className={field}/><ScheduleSubmitButton label="Save Meeting" /></form>
        </details>
      </div>

      <section className="panel overflow-x-auto rounded-2xl p-2">
        <div className="grid min-w-[900px] grid-cols-7 gap-1.5">{days.map(day=>{ const dayJobs=scheduledThisWeek.filter(e=>e.slot?.date===day).sort((a,b)=>(a.slot?.start??"").localeCompare(b.slot?.start??"")); return <div key={day} className="box min-h-[180px] rounded-lg p-1.5 text-center"><div className="mb-1.5 border-b border-[var(--saber-soft)] pb-1.5"><p className="txt text-[11px] font-semibold">{labelDate(day)}</p><p className="sub text-[9px]">{dayJobs.length} scheduled</p></div><div className="space-y-1">{dayJobs.length===0?<p className="box sub rounded-md border-dashed p-1.5 text-center text-[10px]">Open</p>:dayJobs.map(({job,slot})=>{ const meeting=isMeeting(job.scope); return <article key={job.id} className="box rounded-md p-1.5 text-center"><p className="glo text-[10px] font-semibold">{displayTime(slot!.start)}–{displayTime(slot!.end)}</p><p className="txt truncate text-[11px] font-semibold">{meeting?meetingTitle(job.scope):job.customerName}</p><p className="sub truncate text-[9px]">{job.location || "No location"}</p><p className="sub truncate text-[9px]">{meeting?"Team meeting":job.assignedTechName??"Unassigned"}</p><div className="mt-1.5 grid grid-cols-2 gap-1.5"><details className="box relative z-10 min-w-0 rounded-lg"><summary className="cursor-pointer list-none px-2 py-2 text-center text-[11px] font-semibold text-white">Edit</summary><form action={rescheduleJobAction} className="box absolute left-0 top-full z-30 mt-1 w-[260px] space-y-1.5 rounded-xl bg-[#03060d] p-2 text-center"><input type="hidden" name="jobId" value={job.id}/><input type="hidden" name="week" value={weekStart}/><input name="date" type="date" defaultValue={slot!.date} className={field}/><div className="grid grid-cols-2 gap-1"><select name="start" defaultValue={slot!.start} className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select><select name="end" defaultValue={slot!.end} className={field}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select></div>{!meeting?<select name="assignedTechId" defaultValue={job.assignedTechId??""} className={field}><option value="">Unassigned</option>{technicians.map(t=><option key={t.id} value={t.id}>{t.fullName}</option>)}</select>:<input type="hidden" name="assignedTechId" value=""/>}<button type="submit" className="box hot w-full rounded-lg px-3 py-2 text-center text-[11px] text-white">Save</button></form></details><ScheduleDeleteButton jobId={job.id} week={weekStart}/></div>{!meeting?<Link href={`/jobs/${job.id}`} className="sub mt-1 block text-center text-[9px] underline underline-offset-2">Open call</Link>:null}</article>})}</div></div>})}</div>
      </section>
    </div>
  </AppShell>;
}
