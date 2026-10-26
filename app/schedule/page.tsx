import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ScheduleDeleteButton } from "@/components/schedule-delete-button";
import { ScheduleSubmitButton } from "@/components/schedule-submit-button";
import { getActiveTechnicians } from "@/lib/chillbros/operations-queries";
import { getCalendarJobs } from "@/lib/chillbros/schedule-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createTeamMeetingAction, rescheduleJobAction } from "./actions";
import { createScheduleCustomerAction } from "./customer-actions";

export const dynamic = "force-dynamic";
// `week` is the focus date (actions redirect back with it); `day` picks a day on the board.
type Props = { searchParams: Promise<{ week?: string; day?: string; success?: string; error?: string; warning?: string; customer?: string }> };
const field = "min-h-11 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 text-base font-medium text-[#0A1A33] placeholder:text-[#5B6B82]";
const label = "block text-left text-xs font-semibold text-[#2B3F5C]";
const TIMES = Array.from({ length: 48 }, (_, i) => { const total = i * 30; return `${String(Math.floor(total / 60)).padStart(2,"0")}:${String(total % 60).padStart(2,"0")}`; });
const MAX_CHIPS = 3;
function ctToday() { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const map = Object.fromEntries(parts.map((p) => [p.type,p.value])); return `${map.year}-${map.month}-${map.day}`; }
function validDate(value?: string) { return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)); }
function dateAt(value: string) { return new Date(`${value}T12:00:00Z`); }
function ymd(date: Date) { return date.toISOString().slice(0,10); }
function mondayOf(value: string) { const d = dateAt(value); const day = d.getUTCDay(); d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1)); return ymd(d); }
function shift(value: string, days: number) { const d = dateAt(value); d.setUTCDate(d.getUTCDate()+days); return ymd(d); }
function firstOfMonth(value: string) { const d = dateAt(value); d.setUTCDate(1); return ymd(d); }
function addMonths(value: string, months: number) { const d = dateAt(firstOfMonth(value)); d.setUTCMonth(d.getUTCMonth()+months); return ymd(d); }
function lastOfMonth(value: string) { return shift(addMonths(value,1), -1); }
function labelMonth(value: string) { return dateAt(firstOfMonth(value)).toLocaleDateString("en-US", { timeZone:"UTC", month:"long", year:"numeric" }); }
function labelDay(value: string) { return dateAt(value).toLocaleDateString("en-US", { timeZone:"UTC", weekday:"long", month:"short", day:"numeric" }); }
function dayNumber(value: string) { return dateAt(value).getUTCDate(); }
const WEEKDAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
function displayTime(value: string) { const [h,m] = value.split(":").map(Number); return new Date(Date.UTC(2026,0,1,h,m)).toLocaleTimeString("en-US", { timeZone:"UTC", hour:"numeric", minute:"2-digit" }); }
/** "07:00" -> "7a", "13:30" -> "1:30p": fits inside a calendar cell. */
function shortTime(value: string) { const [h,m] = value.split(":").map(Number); return `${h % 12 || 12}${m ? `:${String(m).padStart(2,"0")}` : ""}${h < 12 ? "a" : "p"}`; }
function parseWindow(value: string | null) { const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})-(\d{2}:\d{2}) CT$/); return match ? { date:match[1], start:match[2], end:match[3] } : null; }
function isMeeting(scope: string | null) { return String(scope ?? "").startsWith("[TEAM MEETING]"); }
function meetingTitle(scope: string | null) { return String(scope ?? "").replace(/^\[TEAM MEETING\]\s*/,"").split(" | Attendees:")[0]; }
/** First line of the address only ("15900 La Cantera Pkwy"), so cards stay one line. */
function shortLocation(value: string | null) { return String(value ?? "").split(",")[0].trim(); }
function firstName(value: string | null) { return String(value ?? "").trim().split(/\s+/)[0] ?? ""; }
function uniqueCustomers<T extends { name: string }>(rows: T[]) { const seen = new Set<string>(); return rows.filter((row) => { const key = row.name.trim().toLowerCase().replace(/\s+/g," "); if (seen.has(key)) return false; seen.add(key); return true; }); }

export default async function SchedulePage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager","office"].includes(profile.role)) redirect("/");
  const params = await searchParams;
  const today = ctToday();
  const focus = validDate(params.day) ? params.day! : validDate(params.week) ? params.week! : today;
  const monthStart = firstOfMonth(focus);
  const gridStart = mondayOf(monthStart);
  const gridEnd = shift(mondayOf(lastOfMonth(monthStart)),6);
  const dayCount = Math.round((dateAt(gridEnd).getTime()-dateAt(gridStart).getTime())/86400000)+1;
  const days = Array.from({ length:dayCount },(_,i)=>shift(gridStart,i));
  const selectedDay = focus;
  const [rawCustomers,technicians,jobs] = await Promise.all([getCustomers(),getActiveTechnicians(),getCalendarJobs()]);
  const customers = uniqueCustomers(rawCustomers.filter((c)=>c.name!=="Chill Pros Team"));
  const selectedCustomer = customers.some((customer)=>customer.id===params.customer) ? params.customer : "";
  const parsed = jobs.map((job)=>({job,slot:parseWindow(job.scheduledWindow)})).filter((entry)=>entry.slot).sort((a,b)=>(a.slot!.start).localeCompare(b.slot!.start));
  const onDay = (day: string) => parsed.filter((entry)=>entry.slot!.date===day);
  const scheduledThisMonth = parsed.filter((entry)=>entry.slot!.date>=monthStart && entry.slot!.date<=lastOfMonth(monthStart));
  const selectedJobs = onDay(selectedDay);
  const previousMonth = addMonths(monthStart,-1), nextMonth = addMonths(monthStart,1);
  const newCallHref = (date: string) => { const q = new URLSearchParams({ date, from: "schedule" }); if (selectedCustomer) q.set("customer", selectedCustomer); return `/jobs/new?${q.toString()}`; };
  const dayHref = (date: string) => `/schedule?day=${date}`;
  const navButton = "inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-[#C7D3E2] bg-white px-3 text-sm font-semibold text-[#0A1A33] hover:border-[#1B3FD0]";

  return <AppShell title="Scheduling">
    <div className="cb-new space-y-3.5">
      <section className="cb-card flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
        <div className="min-w-0">
          <p className="cb-display text-[26px] leading-none text-[#0A1A33]">{labelMonth(monthStart)}</p>
          <p className="mt-1 text-sm font-medium text-[#2B3F5C]">{scheduledThisMonth.length} scheduled</p>
        </div>
        <nav aria-label="Change month" className="flex gap-2">
          <Link href={`/schedule?week=${previousMonth}`} className={navButton} aria-label="Previous month"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Prev</Link>
          <Link href="/schedule" className={`${navButton} !border-[#1B3FD0] !bg-[#1B3FD0] !text-white`}>Today</Link>
          <Link href={`/schedule?week=${nextMonth}`} className={navButton} aria-label="Next month">Next<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>
        </nav>
        {params.success ? <p className="w-full rounded-xl bg-[#0A7FC2]/10 px-3 py-2 text-sm font-medium text-[#065A8A]">{params.success}</p> : null}
        {params.warning ? <p className="w-full rounded-xl bg-[#FFB400]/15 px-3 py-2 text-sm font-medium text-[#7A5200]">{params.warning}</p> : null}
        {params.error ? <p className="w-full rounded-xl bg-[#E3261C]/10 px-3 py-2 text-sm font-medium text-[#B91C12]">{params.error}</p> : null}
      </section>

      {/* One form starts every service call: /jobs/new, prefilled with the selected day and any just-added customer. */}
      <Link href={newCallHref(selectedDay)} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1B3FD0] text-base font-semibold text-white shadow-[0_2px_8px_rgba(10,26,51,0.25)] transition hover:bg-[#1530A8]">
        <Plus className="h-5 w-5" aria-hidden="true" />New service call
      </Link>

      <section aria-label={`${labelMonth(monthStart)} calendar`} className="cb-card p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">{WEEKDAY_LABELS.map(day=><p key={day} className="text-center text-[11px] font-semibold uppercase tracking-wide text-[#2B3F5C]">{day}</p>)}</div>
        <div className="mt-1.5 grid grid-cols-7 gap-1 sm:gap-1.5">{days.map(day=>{
          const dayJobs=onDay(day);
          const inMonth=day>=monthStart&&day<=lastOfMonth(monthStart);
          const isToday=day===today, selected=day===selectedDay;
          return <Link key={day} href={dayHref(day)} aria-current={selected?"date":undefined} aria-label={`${labelDay(day)}, ${dayJobs.length} scheduled`} className={`flex min-h-[64px] min-w-0 flex-col overflow-hidden rounded-lg border p-1 text-left transition sm:min-h-[104px] sm:p-1.5 ${selected?"border-[#1B3FD0] bg-[#1B3FD0]/10 ring-2 ring-[#1B3FD0]":"border-[#C7D3E2] bg-white/70 hover:border-[#1B3FD0]"} ${inMonth?"":"opacity-45"}`}>
            <span className="flex items-center justify-between gap-1">
              <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold ${isToday?"bg-[#1B3FD0] text-white":"text-[#0A1A33]"}`}>{dayNumber(day)}</span>
              {dayJobs.length?<span className="rounded-full bg-[#0A1A33]/8 px-1.5 text-[10px] font-bold text-[#0A1A33] sm:hidden">{dayJobs.length}</span>:null}
            </span>
            <span className="mt-1 hidden min-w-0 space-y-0.5 sm:block">
              {dayJobs.slice(0,MAX_CHIPS).map(({job,slot})=>{ const meeting=isMeeting(job.scope); return <span key={job.id} className={`block truncate rounded px-1 py-0.5 text-[11px] font-semibold leading-tight ${meeting?"bg-[#FFB400]/20 text-[#5C3D00]":"bg-[#1B3FD0]/12 text-[#0A1A33]"}`}>{shortTime(slot!.start)} {meeting?meetingTitle(job.scope):job.customerName}</span>; })}
              {dayJobs.length>MAX_CHIPS?<span className="block px-1 text-[10px] font-semibold text-[#2B3F5C]">+{dayJobs.length-MAX_CHIPS} more</span>:null}
            </span>
          </Link>;
        })}</div>
      </section>

      <section aria-labelledby="day-title" className="cb-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[#0A1A33]/10 px-3.5 py-3">
          <div className="min-w-0">
            <h2 id="day-title" className="truncate text-[22px] leading-none">{selectedDay===today?"Today":labelDay(selectedDay)}</h2>
            {selectedDay===today?<p className="mt-1 text-sm text-[#2B3F5C]">{labelDay(selectedDay)}</p>:null}
          </div>
          <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#1B3FD0] px-2.5 py-1 text-sm font-bold text-white">{selectedJobs.length}</span>
        </div>
        {selectedJobs.length===0 ? <div className="px-3.5 py-5 text-sm text-[#2B3F5C]">Nothing scheduled. <Link href={newCallHref(selectedDay)} className="font-semibold text-[#1B3FD0] underline underline-offset-2">Add a call</Link></div> : <ul className="divide-y divide-[#0A1A33]/10">{selectedJobs.map(({job,slot})=>{
          const meeting=isMeeting(job.scope);
          const who=meeting?"Team meeting":job.assignedTechName?firstName(job.assignedTechName):"Unassigned";
          return <li key={job.id} className="px-3.5 py-3">
            <div className="flex items-start gap-3">
              <span className="w-[76px] shrink-0 text-sm font-bold leading-tight text-[#1B3FD0]">{displayTime(slot!.start)}<span className="block text-xs font-medium text-[#2B3F5C]">to {displayTime(slot!.end)}</span></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-[#0A1A33]">{meeting?meetingTitle(job.scope):job.customerName}</p>
                <p className="truncate text-[13px] text-[#2B3F5C]">{[shortLocation(job.location), who].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              <details className="group min-w-0 open:order-last open:col-span-3">
                <summary className="inline-flex min-h-10 w-full cursor-pointer list-none items-center justify-center rounded-xl border border-[#1B3FD0] bg-white px-3 text-sm font-semibold text-[#1B3FD0] group-open:bg-[#1B3FD0] group-open:text-white [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">Edit</span><span className="hidden group-open:inline">Close</span></summary>
                <form data-no-draft action={rescheduleJobAction} className="mt-2.5 grid gap-2 rounded-xl border border-[#C7D3E2] bg-white/80 p-2.5 sm:grid-cols-4">
                  <input type="hidden" name="jobId" value={job.id}/><input type="hidden" name="week" value={selectedDay}/>
                  <label className={label}>Date<input required name="date" type="date" defaultValue={slot!.date} className={`${field} mt-1`}/></label>
                  <label className={label}>Start<select required name="start" defaultValue={slot!.start} className={`${field} mt-1`}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select></label>
                  <label className={label}>End<select required name="end" defaultValue={slot!.end} className={`${field} mt-1`}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select></label>
                  {!meeting?<label className={label}>Technician<select name="assignedTechId" defaultValue={job.assignedTechId??""} className={`${field} mt-1`}><option value="">Keep current</option>{technicians.map(t=><option key={t.id} value={t.id}>{t.fullName}</option>)}</select></label>:<input type="hidden" name="assignedTechId" value=""/>}
                  <button type="submit" className="min-h-11 rounded-xl bg-[#1B3FD0] px-4 text-sm font-semibold text-white hover:bg-[#1530A8] sm:col-span-4">Save changes</button>
                </form>
              </details>
              {!meeting?<Link href={`/jobs/${job.id}`} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#C7D3E2] bg-white px-3 text-sm font-semibold text-[#0A1A33]">Open</Link>:null}
              <ScheduleDeleteButton jobId={job.id} week={selectedDay}/>
            </div>
          </li>;
        })}</ul>}
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        <details className="cb-card group px-3.5 py-2.5">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between font-semibold text-[#0A1A33]">Add customer<ChevronDown className="h-5 w-5 transition group-open:rotate-180" aria-hidden="true" /></summary>
          <form action={createScheduleCustomerAction} className="mt-2 grid gap-2" data-draft-key={`schedule:customer:${monthStart}`} data-draft-label="New schedule customer" noValidate><input type="hidden" name="week" value={selectedDay}/><input required name="name" placeholder="Customer / business name" className={field}/><input name="phone" type="tel" placeholder="Phone" className={field}/><input name="email" type="email" placeholder="Email" className={field}/><input name="address" placeholder="Address" className={field}/><button type="submit" className="min-h-11 rounded-xl bg-[#1B3FD0] px-4 text-sm font-semibold text-white hover:bg-[#1530A8]">Add customer</button></form>
        </details>
        <details className="cb-card group px-3.5 py-2.5">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between font-semibold text-[#0A1A33]">Team meeting<ChevronDown className="h-5 w-5 transition group-open:rotate-180" aria-hidden="true" /></summary>
          <form action={createTeamMeetingAction} className="mt-2 grid gap-2 sm:grid-cols-2" data-draft-key={`schedule:meeting:${monthStart}`} data-draft-label="New team meeting" noValidate><input type="hidden" name="week" value={selectedDay}/><input required name="title" placeholder="Meeting title" className={`${field} sm:col-span-2`}/><label className={`${label} sm:col-span-2`}>Date<input required name="date" type="date" defaultValue={selectedDay} className={`${field} mt-1`}/></label><label className={label}>Start<select required name="start" defaultValue="10:00" className={`${field} mt-1`}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select></label><label className={label}>End<select required name="end" defaultValue="10:30" className={`${field} mt-1`}>{TIMES.map(t=><option key={t} value={t}>{displayTime(t)}</option>)}</select></label><input name="location" placeholder="Where" className={field}/><input name="attendees" placeholder="Who" className={field}/><ScheduleSubmitButton label="Save meeting" /></form>
        </details>
      </div>
    </div>
  </AppShell>;
}
