import Link from "next/link";
import { ChevronDown, ChevronRight, ClipboardList, ReceiptText, UserRound, Wrench } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { JobStatusChip } from "@/components/job-status-chip";
import { LinkJobToUnit } from "@/components/link-job-to-unit";
import { getCustomerProfile } from "@/lib/chillbros/customer-profile";
import { getEquipmentServiceRecord } from "@/lib/chillbros/equipment-service-record";
import { getJob } from "@/lib/chillbros/queries";
import { displayTime, parseWindow } from "@/lib/chillbros/schedule-window";
import type { JobStatus } from "@/lib/chillbros/types";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

const when = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const dateOnly = (value: string) => new Date(value).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" });
const label = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** The visit date: the scheduled day when there is one, otherwise when the call was created. */
function visitDate(scheduledWindow: string | null, createdAt: string) {
  const slot = parseWindow(scheduledWindow);
  if (!slot) return { sortKey: createdAt, date: dateOnly(createdAt), time: null as string | null };
  const date = new Date(`${slot.date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
  return { sortKey: `${slot.date}T${slot.start}`, date, time: `${displayTime(slot.start)}–${displayTime(slot.end)}` };
}

export default async function EquipmentServiceRecordPage({ params }: Props) {
  const [{ id }, profile] = await Promise.all([params, getCurrentStaffProfile()]);
  if (!profile) redirect("/sign-in");
  if (!["manager", "office", "technician"].includes(profile.role)) redirect("/");

  const record = await getEquipmentServiceRecord(id);
  if (!record) notFound();
  const { equipment, jobs, events } = record;
  const canLink = profile.role === "manager" || profile.role === "office";

  // Parts replaced on each visit, from the existing job record.
  const partsByJob = new Map((await Promise.all(jobs.map(async (job) => [job.id, (await getJob(job.id))?.parts ?? []] as const))));
  const history = jobs
    .map((job) => ({ job, visit: visitDate(job.scheduledWindow, job.createdAt), parts: partsByJob.get(job.id) ?? [] }))
    .sort((a, b) => b.visit.sortKey.localeCompare(a.visit.sortKey));

  const linkedIds = new Set(jobs.map((job) => job.id));
  const linkable = canLink
    ? ((await getCustomerProfile(equipment.customerId))?.jobs ?? [])
        .filter((job) => !linkedIds.has(job.id) && !["paid", "cancelled"].includes(job.status))
        .map((job) => ({ id: job.id, label: [job.jobNumber, visitDate(job.scheduledWindow, job.createdAt).date, job.scope].filter(Boolean).join(" · ").slice(0, 90) }))
    : [];

  const unitName = [equipment.manufacturer, equipment.model].filter(Boolean).join(" ") || equipment.equipmentType;
  const details: [string, string | null][] = [
    ["Type", equipment.equipmentType],
    ["Manufacturer", equipment.manufacturer],
    ["Model", equipment.model],
    ["Serial #", equipment.serialNumber],
    ["Refrigerant", equipment.refrigerant],
    ["Asset tag", equipment.assetTag],
  ];

  return (
    <AppShell title={unitName} description={`${equipment.customerName} · ${equipment.equipmentType}`}>
      <div className="cb-new space-y-3.5">
        <section aria-labelledby="unit-title" className="cb-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#0A1A33]/10 px-3.5 py-3">
            <h2 id="unit-title" className="text-[28px] leading-none">Unit</h2>
            {canLink ? (
              <Link href={`/customers/${equipment.customerId}`} className="inline-flex min-h-11 items-center gap-0.5 text-sm font-semibold text-[#1557B0]">
                {equipment.customerName}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <span className="text-sm font-semibold text-[#2B3F5C]">{equipment.customerName}</span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-px bg-[#0A1A33]/10">
            {details.map(([term, value]) => (
              <div key={term} className="bg-[#F8FAFD] px-3.5 py-2.5">
                <dt className="text-[13px] font-medium text-[#2B3F5C]">{term}</dt>
                <dd className={`break-words font-semibold ${value ? "text-[#0A1A33]" : "text-[#5B6B82]"}`}>{value || "Not recorded"}</dd>
              </div>
            ))}
          </dl>
          {equipment.notes ? <p className="border-t border-[#0A1A33]/10 bg-[#F8FAFD] px-3.5 py-3 text-sm font-medium text-[#0A1A33]">{equipment.notes}</p> : null}
        </section>

        <section aria-labelledby="history-title" className="cb-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#0A1A33]/10 px-3.5 py-3">
            <h2 id="history-title" className="text-[28px] leading-none">Service history</h2>
            <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-[#1557B0] px-2.5 py-1 text-sm font-bold text-white">{jobs.length}</span>
          </div>
          {history.length === 0 ? (
            <p className="bg-[#F8FAFD] px-3.5 py-4 text-sm font-medium text-[#2B3F5C]">
              No service visits are linked to this unit yet.{canLink ? " Link a past job below to start its history." : ""}
            </p>
          ) : (
            <ol className="divide-y divide-[#0A1A33]/10">
              {history.map(({ job, visit, parts }) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className="block bg-[#F8FAFD] px-3.5 py-3 transition hover:bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-bold text-[#0A1A33]">{visit.date}</p>
                        {visit.time ? <p className="text-[13px] font-semibold text-[#2B3F5C]">{visit.time}</p> : null}
                      </div>
                      <JobStatusChip status={job.status as JobStatus} assigned={Boolean(job.technicianName)} />
                    </div>
                    <p className="mt-1.5 font-semibold text-[#0A1A33]">{job.scope || "Service call"}</p>
                    {job.workPerformed ? <p className="mt-1 text-sm font-medium text-[#0A1A33]">{job.workPerformed}</p> : null}
                    {parts.length ? (
                      <ul aria-label="Parts replaced" className="mt-2 space-y-1 rounded-lg border border-[#C7D3E2] bg-white px-2.5 py-2">
                        {parts.map((part) => (
                          <li key={part.id} className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="min-w-0 font-semibold text-[#0A1A33]">
                              {part.name}
                              {part.partNumber ? <span className="font-medium text-[#2B3F5C]"> · Part # {part.partNumber}</span> : null}
                            </span>
                            <span className="shrink-0 font-semibold text-[#0A1A33]">× {part.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-medium text-[#2B3F5C]">
                      <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" aria-hidden="true" />{job.technicianName ?? "Unassigned"}</span>
                      <span className="inline-flex items-center gap-1"><Wrench className="h-3.5 w-3.5" aria-hidden="true" />{job.laborHours} hr labor · {job.driveHours} hr drive</span>
                      <span className="inline-flex items-center gap-1"><ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />{job.invoiceNumber ?? "No invoice"}{job.paymentStatus ? ` · ${label(job.paymentStatus)}` : ""}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
          {canLink ? (
            <div className="border-t border-[#0A1A33]/10 px-3.5 py-3">
              <LinkJobToUnit equipmentId={equipment.id} jobs={linkable} />
            </div>
          ) : null}
        </section>
      </div>

      {events.length > 0 ? (
        <details className="group mt-3.5">
          <summary className="cb-new cb-card flex min-h-11 cursor-pointer list-none items-center justify-between px-3.5 py-2.5 font-semibold text-[#0A1A33]">
            <span className="inline-flex items-center gap-2"><ClipboardList className="h-4 w-4" aria-hidden="true" />Full activity log ({events.length})</span>
            <ChevronDown className="h-5 w-5 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ol className="cb-new cb-card mt-2 divide-y divide-[#0A1A33]/10 overflow-hidden">
            {events.slice(0, 60).map((event) => (
              <li key={event.id} className="bg-[#F8FAFD] px-3.5 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[#0A1A33]">{label(event.stage)}</p>
                  <p className="text-[13px] font-medium text-[#2B3F5C]">{when(event.createdAt)}</p>
                </div>
                <p className="mt-0.5 text-sm font-medium text-[#0A1A33]">{event.message}</p>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </AppShell>
  );
}
