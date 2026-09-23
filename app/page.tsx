import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, CreditCard, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EN_ROUTE_STATUSES, JobStatusChip, ON_SITE_STATUSES } from "@/components/job-status-chip";
import { getInvoiceCenterData } from "@/lib/chillbros/billing-queries";
import { getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCalendarJobs } from "@/lib/chillbros/schedule-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const CLOSED_STATUSES = ["paid", "completed", "cancelled"];

function ctToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function parseWindow(value: string | null) {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})-(\d{2}:\d{2}) CT$/);
  return match ? { date: match[1], start: match[2], end: match[3] } : null;
}

function displayTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  return new Date(Date.UTC(2026, 0, 1, h, m)).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" });
}

function attentionMeta(stage: string, status: string) {
  if (stage === "approved_needs_action" || stage === "approved") return { priority: 1, label: "Approved · choose work or return visit", tone: "text-[#1D7A4C]", icon: CheckCircle2 };
  if (stage === "payment_method_selected") return { priority: 2, label: "Manual payment needs verification", tone: "text-[#B4531A]", icon: CreditCard };
  if (stage === "invoice_issued") return { priority: 3, label: "Invoice issued · awaiting payment", tone: "text-[#B4531A]", icon: CreditCard };
  if (stage === "estimate_published" || stage === "awaiting_approval") return { priority: 4, label: "Estimate awaiting customer approval", tone: "text-[#1557B0]", icon: ClipboardList };
  if (stage === "return_scheduled") return { priority: 5, label: "Return visit scheduled", tone: "text-[#1557B0]", icon: CalendarDays };
  if (stage === "approved_work_now") return { priority: 6, label: "Approved work in progress", tone: "text-[#1557B0]", icon: ClipboardList };
  if (status === "completed" && stage === "completed") return { priority: 7, label: "Completed call · review billing", tone: "text-[#4A5D78]", icon: AlertCircle };
  return null;
}

function StatCard({ href, label, value, valueClass = "text-[#0A1A33]", hint, hintClass = "text-[#4A5D78]" }: { href: string; label: string; value: string; valueClass?: string; hint: string; hintClass?: string }) {
  return (
    <Link href={href} className="cb-card block min-h-[112px] p-3.5 transition hover:border-[#1557B0]">
      <p className="text-[13px] font-medium text-[#4A5D78]">{label}</p>
      <p className={`cb-display mt-1 text-[34px] leading-none ${valueClass}`}>{value}</p>
      <p className={`mt-1.5 text-[13px] font-medium ${hintClass}`}>{hint}</p>
    </Link>
  );
}

export default async function HomePage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role === "technician") redirect("/technician");
  if (profile.role === "office") redirect("/office");

  const [jobs, lifecycleJobs, invoiceCenter] = await Promise.all([
    getCalendarJobs(),
    getDispatchJobs(150),
    getInvoiceCenterData().catch(() => ({ rows: [], metrics: { outstandingValue: 0, dueToday: 0, overdueValue: 0, collectedThisMonth: 0, pendingApproval: 0, averageDaysToPay: 0 } })),
  ]);
  const { metrics: billingMetrics, rows: invoiceRows } = invoiceCenter;

  const today = ctToday();
  const todaySchedule = jobs
    .map((job) => ({ job, slot: parseWindow(job.scheduledWindow) }))
    .filter((entry) => entry.slot?.date === today)
    .sort((a, b) => (a.slot?.start ?? "").localeCompare(b.slot?.start ?? ""));
  const inProgressToday = todaySchedule.filter(({ job }) => ON_SITE_STATUSES.includes(job.status) || EN_ROUTE_STATUSES.includes(job.status)).length;
  // Same rule as the Dispatch board: any open job with no technician.
  const unassignedCount = lifecycleJobs.filter((job) => !CLOSED_STATUSES.includes(job.status) && !job.assignedTechId).length;
  const overdueCount = invoiceRows.filter((row) => row.daysOverdue > 0).length;

  const attention = lifecycleJobs
    .map((job) => ({ job, meta: attentionMeta(job.workflowStage, job.status) }))
    .filter((entry): entry is { job: (typeof lifecycleJobs)[number]; meta: NonNullable<ReturnType<typeof attentionMeta>> } => Boolean(entry.meta))
    .sort((a, b) => a.meta.priority - b.meta.priority)
    .slice(0, 12);

  return (
    <AppShell title="Home" description="One service call record from intake through payment." notificationCount={attention.length}>
      <div className="cb-new space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <StatCard href="/technician" label="Jobs today" value={String(todaySchedule.length)} hint={`${inProgressToday} in progress`} />
          <StatCard
            href="/dispatch"
            label="Unassigned"
            value={String(unassignedCount)}
            valueClass={unassignedCount > 0 ? "text-[#B4531A]" : "text-[#0A1A33]"}
            hint={unassignedCount > 0 ? "Assign now" : "All assigned"}
            hintClass={unassignedCount > 0 ? "text-[#1557B0] font-semibold" : "text-[#4A5D78]"}
          />
          <StatCard
            href="/invoices?status=overdue"
            label="Overdue"
            value={money.format(billingMetrics.overdueValue)}
            valueClass={overdueCount > 0 ? "text-[#B4531A]" : "text-[#0A1A33]"}
            hint={`${overdueCount} invoice${overdueCount === 1 ? "" : "s"}`}
          />
          <StatCard href="/invoices" label="Collected this month" value={money.format(billingMetrics.collectedThisMonth)} hint="Paid invoices" />
        </div>

        <section className="cb-card overflow-hidden" aria-labelledby="todays-schedule">
          <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] px-3.5 py-3">
            <h2 id="todays-schedule" className="text-[26px] leading-none">Today&apos;s schedule</h2>
            <Link href="/schedule" className="inline-flex min-h-11 items-center gap-0.5 px-1 text-sm font-semibold text-[#1557B0] hover:text-[#0E3F82]">
              View all
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {todaySchedule.length === 0 ? (
            <p className="px-3.5 py-5 text-sm text-[#4A5D78]">Nothing scheduled for today.</p>
          ) : (
            <ul className="divide-y divide-[#EEF2F7]">
              {todaySchedule.map(({ job, slot }) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className="flex min-h-[64px] items-center gap-3 px-3.5 py-2.5 transition hover:bg-[#F5F8FC]">
                    <span className="w-[62px] shrink-0 text-sm font-semibold text-[#0A1A33]">{displayTime(slot!.start)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[#0A1A33]">{job.customerName}</span>
                      <span className="block truncate text-[13px] text-[#4A5D78]">{job.scope?.trim() || "No complaint recorded"}</span>
                    </span>
                    <JobStatusChip status={job.status} assigned={Boolean(job.assignedTechId)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link
          href="/create?mode=job"
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1557B0] text-base font-semibold text-white shadow-[0_2px_8px_rgba(10,26,51,0.25)] transition [text-shadow:none] hover:bg-[#0E3F82]"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          New service call
        </Link>

        <section id="needs-attention" className="cb-card scroll-mt-4 overflow-hidden" aria-labelledby="needs-attention-title">
          <h2 id="needs-attention-title" className="border-b border-[#EEF2F7] px-3.5 py-3 text-[26px] leading-none">Needs attention</h2>
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 px-3.5 py-5 text-sm text-[#1D7A4C]">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              No workflow handoffs are waiting on you.
            </p>
          ) : (
            <ul className="divide-y divide-[#EEF2F7]">
              {attention.map(({ job, meta }) => {
                const Icon = meta.icon;
                return (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.id}`} className="flex min-h-[64px] items-start gap-3 px-3.5 py-2.5 transition hover:bg-[#F5F8FC]">
                      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.tone}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-[#0A1A33]">{job.customerName}</span>
                        <span className={`block text-[13px] font-medium ${meta.tone}`}>{meta.label}</span>
                        <span className="block truncate text-[13px] text-[#4A5D78]">{job.location || "No location"} · {job.assignedTechName || "Unassigned"}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
