import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DispatchAssignRow } from "@/components/dispatch-assign-row";
import { DispatchPanel } from "@/components/dispatch-panel";
import { DispatchIntelligence } from "@/components/dispatch-intelligence";
import { EquipmentFirstIntake } from "@/components/equipment-first-intake";
import { EN_ROUTE_STATUSES, ON_SITE_STATUSES } from "@/components/job-status-chip";
import { JobAssetReturnPanel } from "@/components/job-asset-return-panel";
import { LiveOfficeRefresh } from "@/components/live-office-refresh";
import { SectionCard } from "@/components/section-card";
import { getEquipment } from "@/lib/chillbros/equipment-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { getActiveTechnicians, getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCalendarJobs } from "@/lib/chillbros/schedule-queries";
import { addDays, ctToday, dayParts, displayTime, parseWindow } from "@/lib/chillbros/schedule-window";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const CLOSED_STATUSES = ["paid", "completed", "cancelled"];
const DAYS_SHOWN = 5;

type Props = { searchParams: Promise<{ day?: string }> };

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
}

export default async function DispatchPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");

  const [customers, technicians, jobs, calendarJobs, equipment] = await Promise.all([
    getCustomers(),
    getActiveTechnicians(),
    getDispatchJobs(250),
    getCalendarJobs(),
    getEquipment(),
  ]);

  const today = ctToday();
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i));
  const params = await searchParams;
  const selectedDay = days.includes(params.day ?? "") ? params.day! : today;

  const isOpen = (status: string) => !CLOSED_STATUSES.includes(status);
  const dayJobs = calendarJobs.filter((job) => parseWindow(job.scheduledWindow)?.date === selectedDay && isOpen(job.status));
  const jobsOnDay = (date: string) => calendarJobs.filter((job) => parseWindow(job.scheduledWindow)?.date === date && isOpen(job.status)).length;

  // Unassigned: open calls requested for the selected day, then open calls
  // with no requested time yet (they need a tech whichever day is picked).
  const unassignedForDay = dayJobs
    .filter((job) => !job.assignedTechId)
    .sort((a, b) => (parseWindow(a.scheduledWindow)?.start ?? "").localeCompare(parseWindow(b.scheduledWindow)?.start ?? ""));
  const unassignedNoTime = jobs.filter((job) => isOpen(job.status) && !job.assignedTechId && !parseWindow(job.scheduledWindow));
  const unassigned = [...unassignedForDay, ...unassignedNoTime];

  const openJobs = jobs.filter((job) => isOpen(job.status));
  const techRows = technicians.map((tech) => {
    const count = dayJobs.filter((job) => job.assignedTechId === tech.id).length;
    const onSite = openJobs.find((job) => job.assignedTechId === tech.id && ON_SITE_STATUSES.includes(job.status));
    const enRoute = openJobs.find((job) => job.assignedTechId === tech.id && EN_ROUTE_STATUSES.includes(job.status));
    const status = onSite ? `On site · ${onSite.customerName}` : enRoute ? `En route · ${enRoute.customerName}` : "Available";
    return { tech, count, status, busy: Boolean(onSite || enRoute) };
  });
  const barMax = Math.max(4, ...techRows.map((row) => row.count));
  const techOptions = technicians.map((tech) => ({ id: tech.id, fullName: tech.fullName }));

  return (
    <AppShell title="Dispatch" description="Assign calls and balance technician workload.">
      <LiveOfficeRefresh />
      <div className="cb-new space-y-3.5">
        <nav aria-label="Choose day" className="grid grid-cols-5 gap-2">
          {days.map((date, i) => {
            const { weekday, day, label } = dayParts(date);
            const selected = date === selectedDay;
            const count = jobsOnDay(date);
            return (
              <Link
                key={date}
                href={i === 0 ? "/dispatch" : `/dispatch?day=${date}`}
                aria-current={selected ? "date" : undefined}
                aria-label={`${label}, ${count} job${count === 1 ? "" : "s"}`}
                className={`flex min-h-[72px] flex-col items-center justify-center rounded-xl border text-center transition ${
                  selected
                    ? "border-[#1557B0] bg-[#1557B0] text-white shadow-[0_4px_12px_rgba(10,26,51,0.25)]"
                    : "cb-card text-[#0A1A33] hover:border-[#1557B0]"
                }`}
              >
                <span className={`text-xs font-semibold uppercase ${selected ? "text-white" : "text-[#4A5D78]"}`}>{i === 0 ? "Today" : weekday}</span>
                <span className="cb-display text-[26px] leading-none">{day}</span>
                <span className={`text-[11px] font-medium ${selected ? "text-white" : "text-[#4A5D78]"}`}>{count} job{count === 1 ? "" : "s"}</span>
              </Link>
            );
          })}
        </nav>

        <section aria-labelledby="unassigned-title" className="cb-card overflow-hidden !border-2 !border-[#0B5CD5]">
          <div className="flex items-center justify-between gap-3 border-b border-[#0A1A33]/10 px-3.5 py-3">
            <h2 id="unassigned-title" className="text-[28px] leading-none">Unassigned</h2>
            <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-[#0B5CD5] px-2.5 py-1 text-sm font-bold text-white">{unassigned.length}</span>
          </div>
          {unassigned.length === 0 ? (
            <p className="px-3.5 py-5 text-sm text-[#4A5D78]">Every call for {dayParts(selectedDay).label} has a technician.</p>
          ) : (
            <ul className="divide-y divide-[#0A1A33]/10">
              {unassigned.map((job) => {
                const slot = parseWindow(job.scheduledWindow);
                return (
                  <li key={job.id} className="px-3.5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-[#0A1A33]">{job.customerName}</span>
                        <span className="block truncate text-[13px] text-[#4A5D78]">{job.scope?.trim() || "No complaint recorded"}</span>
                      </Link>
                      <span className="shrink-0 text-right text-sm font-semibold text-[#0A1A33]">
                        {slot ? `${displayTime(slot.start)}–${displayTime(slot.end)}` : <span className="text-[13px] font-medium text-[#4A5D78]">No time requested</span>}
                      </span>
                    </div>
                    <DispatchAssignRow jobId={job.id} customerName={job.customerName} technicians={techOptions} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="technicians-title" className="cb-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#0A1A33]/10 px-3.5 py-3">
            <h2 id="technicians-title" className="text-[28px] leading-none">Technicians</h2>
            <span className="text-sm font-medium text-[#4A5D78]">{dayParts(selectedDay).weekday} {dayParts(selectedDay).day}</span>
          </div>
          {techRows.length === 0 ? (
            <p className="px-3.5 py-5 text-sm text-[#4A5D78]">No active technicians.</p>
          ) : (
            <ul className="divide-y divide-[#0A1A33]/10">
              {techRows.map(({ tech, count, status, busy }) => (
                <li key={tech.id} className="flex items-center gap-3 px-3.5 py-3">
                  <span aria-hidden="true" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#9FD3FF] text-sm font-bold text-[#0A1A33]">
                    {initialsFor(tech.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold text-[#0A1A33]">{tech.fullName}</span>
                      <span className="shrink-0 text-[13px] font-semibold text-[#0A1A33]">
                        {count} job{count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#0A1A33]/10"
                      role="meter"
                      aria-label={`${tech.fullName} workload`}
                      aria-valuemin={0}
                      aria-valuemax={barMax}
                      aria-valuenow={count}
                    >
                      <div className="h-full rounded-full bg-[#1557B0]" style={{ width: `${Math.round((count / barMax) * 100)}%` }} />
                    </div>
                    <p className={`mt-1 truncate text-[13px] ${busy ? "font-semibold text-[#0E3F82]" : "text-[#4A5D78]"}`}>{status}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <details className="group mt-3.5">
        <summary className="cb-new cb-card flex min-h-11 cursor-pointer list-none items-center justify-between px-3.5 py-2.5 font-semibold text-[#0A1A33]">
          More dispatch tools
          <ChevronDown className="h-5 w-5 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-3.5 space-y-3.5">
          <SectionCard eyebrow="Phase 6 · Intelligence" title="Dispatch recommendations" description="Balance active workload and surface the next assignment decision before opening individual calls."><DispatchIntelligence jobs={jobs} technicians={technicians} /></SectionCard>
          <SectionCard eyebrow="Equipment-linked intake" title="Create service call" description="Start with the customer and exact unit so the permanent history begins correctly."><EquipmentFirstIntake customers={customers} technicians={technicians} equipment={equipment} /></SectionCard>
          <SectionCard eyebrow="Operations" title="Dispatch board" description="Assign work, balance technician workload, and follow jobs from scheduling through billing."><DispatchPanel customers={customers} technicians={technicians} jobs={jobs} /></SectionCard>
          <SectionCard eyebrow="Equipment & return visits" title="Asset and return controls" description="Correct the linked asset and schedule return trips without duplicate work orders."><JobAssetReturnPanel jobs={jobs} equipment={equipment} technicians={technicians} /></SectionCard>
        </div>
      </details>
    </AppShell>
  );
}
