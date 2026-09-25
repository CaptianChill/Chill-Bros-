import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronRight, Clock3, Search, StickyNote, Radar } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ClockCard } from "@/components/clock-card";
import { JobStatusChip } from "@/components/job-status-chip";
import { getDispatchJobs, getOpenTimesheet, type DispatchJob } from "@/lib/chillbros/operations-queries";
import { ctToday, displayTime, parseWindow } from "@/lib/chillbros/schedule-window";
import { getAssignedFieldJobsForTechnician } from "@/lib/chillbros/technician-assignment";
import { JOB_ACTIVE_STATUSES } from "@/lib/chillbros/types";
import { landingBucket } from "@/lib/chillbros/work-page";
import { getJobListExtras, type JobListExtras } from "@/lib/chillbros/work-page-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ saved?: string; rescheduled?: string; submitted?: string; success?: string; error?: string }> };

const FIELD_VISIBLE = new Set(["scheduled", "in_progress", "dispatched", "en_route", "arrived", "diagnosing", "awaiting_approval", "approved", "parts_required", "return_visit_needed", "repairing", "work_complete", "ready_to_invoice"]);

function when(scheduledWindow: string | null, today: string) {
  const slot = parseWindow(scheduledWindow);
  if (!slot) return scheduledWindow?.trim() || "No time set";
  const day = slot.date === today ? "Today" : new Date(`${slot.date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${displayTime(slot.start)}–${displayTime(slot.end)}`;
}

function byTime(a: DispatchJob, b: DispatchJob) {
  const sa = parseWindow(a.scheduledWindow), sb = parseWindow(b.scheduledWindow);
  return `${sa?.date ?? "9999"}${sa?.start ?? ""}`.localeCompare(`${sb?.date ?? "9999"}${sb?.start ?? ""}`);
}

function Section({ id, title, count, open, empty, children }: { id: string; title: string; count: number; open?: boolean; empty: string; children: React.ReactNode }) {
  return (
    <details id={id} open={open || undefined} className="cb-work-card group overflow-hidden">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
        <h2 className="text-xl font-bold">{title}</h2>
        <span className="flex items-center gap-2">
          <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-[#1557B0] px-2.5 py-1 text-sm font-bold text-white">{count}</span>
          <ChevronDown className="h-5 w-5 transition group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      {count === 0 ? <p className="border-t border-[#0A1A33]/10 px-3.5 py-3 text-sm font-medium text-[#2B3F5C]">{empty}</p> : <ul className="divide-y divide-[#0A1A33]/10 border-t border-[#0A1A33]/10">{children}</ul>}
    </details>
  );
}

function JobCard({ job, extras, today, showTech, highlight, note }: { job: DispatchJob; extras?: JobListExtras; today: string; showTech: boolean; highlight: boolean; note?: string }) {
  return (
    <li className={highlight ? "bg-[#DCEBFF]" : "bg-white"}>
      <div className="px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 font-bold leading-tight">{job.customerName}</p>
          <JobStatusChip status={job.status} assigned={Boolean(job.assignedTechId)} />
        </div>
        <p className="mt-1 text-sm font-semibold">{when(job.scheduledWindow, today)}</p>
        <p className="truncate text-[13px] font-medium text-[#2B3F5C]">{extras?.equipmentLabel ?? "No unit linked"}{job.location ? ` · ${job.location}` : ""}</p>
        {note ? <p className="text-[13px] font-semibold text-[#1557B0]">{note}</p> : null}
        {showTech ? <p className="text-[12px] font-medium text-[#5B6B82]">{job.assignedTechName ?? "Unassigned"}</p> : null}
        <Link href={`/jobs/${job.id}`} className="mt-2 flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-[#1557B0] font-semibold text-white">
          Open Work Page
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}

function savedNote(extras: JobListExtras | undefined) {
  const invoice = extras?.invoice;
  if (!invoice) return "Saved call · no quote yet";
  if (invoice.issued) return `Invoice ${invoice.number} · ${invoice.paymentStatus === "paid" ? "paid" : "sent for payment"}`;
  if (invoice.status === "approved") return `Quote ${invoice.number} approved · invoice when work is done`;
  return `Quote ${invoice.number} · ${invoice.status === "draft" ? "draft" : "waiting on customer"}`;
}

// Technician landing: today's calls first, then active and saved work, each
// card opening the single Work Page. Managers see every field job here.
export default async function TechnicianPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (!["technician", "manager"].includes(profile.role)) redirect("/dispatch");
  const isManager = profile.role === "manager";

  const [params, allJobs, openTimesheet] = await Promise.all([
    searchParams,
    isManager ? getDispatchJobs(250) : getAssignedFieldJobsForTechnician({ id: profile.id, email: profile.email, fullName: profile.fullName }, 250),
    getOpenTimesheet(profile.id),
  ]);
  // A technician only sees jobs assigned to their own profile — the same rule
  // the Work Page enforces — so every card here opens.
  const fieldJobs = allJobs
    .filter((job) => JOB_ACTIVE_STATUSES.includes(job.status) && FIELD_VISIBLE.has(job.status))
    .filter((job) => isManager || job.assignedTechId === profile.id)
    .sort(byTime);
  const extras = await getJobListExtras(fieldJobs.map((job) => job.id));
  const today = ctToday();

  const buckets = { today: [] as DispatchJob[], active: [] as DispatchJob[], saved: [] as DispatchJob[] };
  for (const job of fieldJobs) buckets[landingBucket({ status: job.status, scheduledDate: parseWindow(job.scheduledWindow)?.date ?? null }, today)].push(job);

  const focusId = params.saved ?? params.rescheduled ?? params.submitted;
  const focusJob = focusId ? allJobs.find((job) => job.id === focusId) : undefined;
  const banner = params.error
    ? { tone: "error", text: params.error }
    : params.success
      ? { tone: "ok", text: `${focusJob ? `${focusJob.customerName}: ` : ""}${params.success}` }
      : params.saved && focusJob
        ? { tone: "ok", text: `Saved ${focusJob.customerName}. Everything you entered is on the job.` }
        : params.submitted
          ? { tone: "ok", text: "Job submitted to the office." }
          : null;

  const tools = [
    { href: "/field-notes", label: "Field Notes", icon: StickyNote },
    { href: "/timesheet", label: "Clock", icon: Clock3 },
    { href: "/parts-lookup", label: "Parts Pro", icon: Search },
    ...(isManager ? [] : [{ href: "/revenue-radar/handoffs", label: "Tech Requests", icon: Radar }]),
  ];

  return (
    <AppShell
      lead={<ClockCard open={openTimesheet ? { id: openTimesheet.id, clockInAt: openTimesheet.clockInAt, location: openTimesheet.location } : null} />}
      title={isManager ? "Field jobs" : "My work"}
      description={isManager ? "Every live field call. Open one to work it or step in." : "Today's calls, active calls and saved work. Tap a call to open its Work Page."}
    >
      <div className="cb-new space-y-3.5">
        {banner ? (
          <p role={banner.tone === "error" ? "alert" : "status"} className={`cb-work-card flex items-center gap-2 p-3.5 font-semibold ${banner.tone === "error" ? "text-[#B42318]" : ""}`}>
            {banner.tone === "ok" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0A7FC2]" aria-hidden="true" /> : null}
            {banner.text}
          </p>
        ) : null}

        <Section id="today" title="Today's jobs" count={buckets.today.length} open empty="Nothing scheduled for you today.">
          {buckets.today.map((job) => <JobCard key={job.id} job={job} extras={extras[job.id]} today={today} showTech={isManager} highlight={job.id === focusId} />)}
        </Section>

        <Section id="active" title="Active calls" count={buckets.active.length} open={buckets.today.length === 0 && buckets.active.length > 0} empty="No other active or upcoming calls.">
          {buckets.active.map((job) => <JobCard key={job.id} job={job} extras={extras[job.id]} today={today} showTech={isManager} highlight={job.id === focusId} />)}
        </Section>

        <Section id="saved" title="Saved calls · quotes · invoices" count={buckets.saved.length} empty="No calls waiting on parts, approval or invoicing.">
          {buckets.saved.map((job) => <JobCard key={job.id} job={job} extras={extras[job.id]} today={today} showTech={isManager} highlight={job.id === focusId} note={savedNote(extras[job.id])} />)}
        </Section>

        <nav aria-label="Field tools" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tools.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="cb-work-card flex min-h-12 items-center justify-center gap-2 px-2 font-semibold text-[#1557B0]">
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </AppShell>
  );
}
