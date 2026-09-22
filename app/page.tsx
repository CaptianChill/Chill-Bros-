import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, Banknote, CalendarDays, CheckCircle2, ClipboardList, CreditCard, Route, UsersRound } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { SectionCard } from "@/components/section-card";
import { getInvoiceCenterData } from "@/lib/chillbros/billing-queries";
import { getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCustomers, getRevenueRadarPulse, getTopRevenueRadarProspects } from "@/lib/chillbros/queries";
import { getCalendarJobs } from "@/lib/chillbros/schedule-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

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

function uniqueCustomers<T extends { name: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = row.name.trim().toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function attentionMeta(stage: string, status: string) {
  if (stage === "approved_needs_action" || stage === "approved") return { priority: 1, label: "Approved · choose work or return visit", tone: "text-emerald-200", icon: CheckCircle2 };
  if (stage === "payment_method_selected") return { priority: 2, label: "Manual payment needs verification", tone: "text-amber-200", icon: CreditCard };
  if (stage === "invoice_issued") return { priority: 3, label: "Invoice issued · awaiting payment", tone: "text-amber-200", icon: CreditCard };
  if (stage === "estimate_published" || stage === "awaiting_approval") return { priority: 4, label: "Estimate awaiting customer approval", tone: "text-cyan-100", icon: ClipboardList };
  if (stage === "return_scheduled") return { priority: 5, label: "Return visit scheduled", tone: "text-[var(--saber)]", icon: CalendarDays };
  if (stage === "approved_work_now") return { priority: 6, label: "Approved work in progress", tone: "text-[var(--saber)]", icon: ClipboardList };
  if (status === "completed" && stage === "completed") return { priority: 7, label: "Completed call · review billing", tone: "text-zinc-200", icon: AlertCircle };
  return null;
}

export default async function HomePage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role === "technician") redirect("/technician");
  if (profile.role === "office") redirect("/office");

  const [rawCustomers, jobs, lifecycleJobs, invoiceCenter, revenueRadarPulse, topLeads] = await Promise.all([
    getCustomers(),
    getCalendarJobs(),
    getDispatchJobs(150),
    getInvoiceCenterData().catch(() => ({ rows: [], metrics: { outstandingValue: 0, dueToday: 0, overdueValue: 0, collectedThisMonth: 0, pendingApproval: 0, averageDaysToPay: 0 } })),
    getRevenueRadarPulse().catch(() => ({ newLeads: 0, highPriorityLeads: 0 })),
    getTopRevenueRadarProspects(3).catch(() => []),
  ]);
  const { metrics: billingMetrics } = invoiceCenter;

  const customers = uniqueCustomers(rawCustomers.filter((customer) => customer.name !== "Chill Pros Team"));
  const today = ctToday();
  const todaySchedule = jobs
    .map((job) => ({ job, slot: parseWindow(job.scheduledWindow) }))
    .filter((entry) => entry.slot?.date === today)
    .sort((a, b) => (a.slot?.start ?? "").localeCompare(b.slot?.start ?? ""));
  const visibleToday = todaySchedule.slice(0, 14);
  const extraToday = todaySchedule.slice(14);

  const attention = lifecycleJobs
    .map((job) => ({ job, meta: attentionMeta(job.workflowStage, job.status) }))
    .filter((entry): entry is { job: (typeof lifecycleJobs)[number]; meta: NonNullable<ReturnType<typeof attentionMeta>> } => Boolean(entry.meta))
    .sort((a, b) => a.meta.priority - b.meta.priority)
    .slice(0, 12);

  const scheduleTile = ({ job, slot }: (typeof todaySchedule)[number]) => (
    <Link key={job.id} href={`/jobs/${job.id}`} className="min-w-0 rounded-lg border border-white/10 bg-white/[0.02] p-2 transition hover:border-[var(--saber-soft)] hover:bg-white/[0.05]">
      <p className="truncate text-[11px] font-semibold text-[var(--saber)]">{displayTime(slot!.start)}</p>
      <p className="mt-0.5 truncate text-[11px] font-semibold text-white">{job.customerName}</p>
      <p className="mt-0.5 truncate text-[10px] text-zinc-400">{job.location || "No location"}</p>
      <p className="truncate text-[10px] text-zinc-500">{job.assignedTechName || "Unassigned"}</p>
    </Link>
  );

  return (
    <AppShell title="Home" description="One service call record from intake through payment." notificationCount={attention.length}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard label="Today's Jobs" value={todaySchedule.length} href="/schedule" size="lg" tone="cyan" />
          <MetricCard label="Office Queue" value={attention.length} href="#needs-attention" size="lg" tone={attention.length > 0 ? "amber" : "emerald"} />
        </div>

        <SectionCard eyebrow="Owner snapshot" title="Revenue & pipeline">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <MetricCard label="Outstanding" value={money.format(billingMetrics.outstandingValue)} href="/invoices" tone="amber" />
            <MetricCard label="Overdue" value={money.format(billingMetrics.overdueValue)} href="/invoices" tone={billingMetrics.overdueValue > 0 ? "rose" : "default"} />
            <MetricCard label="Collected this month" value={money.format(billingMetrics.collectedThisMonth)} href="/payments" tone="emerald" />
            <MetricCard label="Hot leads (65+)" value={revenueRadarPulse.highPriorityLeads} href="/revenue-radar" tone="cyan" />
          </div>
        </SectionCard>

        <SectionCard title="Today's run">
          <div className="mb-2 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-zinc-300"><CalendarDays className="h-4 w-4 text-[var(--saber)]" /><span>{todaySchedule.length} scheduled</span></div><Link href="/schedule" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-200">Open Schedule</Link></div>
          {todaySchedule.length === 0 ? <p className="rounded-lg border border-dashed border-white/10 p-3 text-sm text-zinc-500">Nothing scheduled for today.</p> : <><div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">{visibleToday.map(scheduleTile)}</div>{extraToday.length > 0 ? <details className="mt-2 rounded-lg border border-white/10 bg-black/20"><summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold text-zinc-300">Show {extraToday.length} more today</summary><div className="grid grid-cols-2 gap-1.5 border-t border-white/10 p-2 sm:grid-cols-4 lg:grid-cols-7">{extraToday.map(scheduleTile)}</div></details> : null}</>}
        </SectionCard>

        {topLeads.length > 0 ? (
          <SectionCard eyebrow="Sales" title="Revenue Radar — hot leads">
            <div className="grid gap-2 md:grid-cols-3">
              {topLeads.map((lead) => (
                <Link key={lead.id} href={`/revenue-radar/${lead.id}`} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-[var(--saber-soft)] hover:bg-white/[0.05]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg font-bold text-[var(--saber)]">{Math.round(lead.score)}%</p>
                    <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-200">Hot lead</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-white">{lead.businessName}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{lead.category.replace(/_/g, " ")}{lead.city ? ` · ${lead.city}` : ""}</p>
                </Link>
              ))}
            </div>
            <Link href="/revenue-radar" className="mt-3 inline-flex text-xs font-semibold text-zinc-300 underline decoration-white/20 underline-offset-4">Open Revenue Radar →</Link>
          </SectionCard>
        ) : null}

        <SectionCard id="needs-attention" title="Needs attention">
          {attention.length === 0 ? (
            <div className="flex items-center justify-center gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-100"><CheckCircle2 className="h-5 w-5" />No workflow handoffs are waiting on you.</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {attention.map(({ job, meta }) => {
                const Icon = meta.icon;
                return <Link key={job.id} href={`/jobs/${job.id}`} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 transition hover:border-[var(--saber-soft)] hover:bg-white/[0.05]"><div className="flex items-start gap-3"><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.tone}`} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{job.customerName}</p><p className={`mt-1 text-xs font-medium ${meta.tone}`}>{meta.label}</p><p className="mt-1 truncate text-[11px] text-zinc-500">{job.location || "No location"} · {job.assignedTechName || "Unassigned"}</p></div></div></Link>;
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard eyebrow="Core workflow" title="One path from call to cash" description="These are the operating screens. Everything else stays out of the way until the core system is stable.">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Link href="/schedule" className="rounded-lg border border-white/10 bg-white/[0.02] p-3 transition hover:border-[var(--saber-soft)] hover:bg-white/[0.05]"><CalendarDays className="mx-auto h-4 w-4 text-[var(--saber)]" /><p className="mt-2 text-sm font-semibold text-white">1. Schedule</p><p className="mt-1 text-[11px] text-zinc-500">Book the call</p></Link>
            <Link href="/dispatch" className="rounded-lg border border-white/10 bg-white/[0.02] p-3 transition hover:border-[var(--saber-soft)] hover:bg-white/[0.05]"><Route className="mx-auto h-4 w-4 text-[var(--saber)]" /><p className="mt-2 text-sm font-semibold text-white">2. Dispatch / Job</p><p className="mt-1 text-[11px] text-zinc-500">Assign and work it</p></Link>
            <Link href="/customers" className="rounded-lg border border-white/10 bg-white/[0.02] p-3 transition hover:border-[var(--saber-soft)] hover:bg-white/[0.05]"><UsersRound className="mx-auto h-4 w-4 text-[var(--saber)]" /><p className="mt-2 text-sm font-semibold text-white">3. Customer</p><p className="mt-1 text-[11px] text-zinc-500">Keep one record</p></Link>
            <Link href="/invoices" className="rounded-lg border border-white/10 bg-white/[0.02] p-3 transition hover:border-[var(--saber-soft)] hover:bg-white/[0.05]"><Banknote className="mx-auto h-4 w-4 text-[var(--saber)]" /><p className="mt-2 text-sm font-semibold text-white">4. Quote / Invoice</p><p className="mt-1 text-[11px] text-zinc-500">Approve and bill</p></Link>
            <Link href="/payments" className="rounded-lg border border-white/10 bg-white/[0.02] p-3 transition hover:border-[var(--saber-soft)] hover:bg-white/[0.05]"><CreditCard className="mx-auto h-4 w-4 text-[var(--saber)]" /><p className="mt-2 text-sm font-semibold text-white">5. Payment</p><p className="mt-1 text-[11px] text-zinc-500">Close the loop</p></Link>
          </div>
        </SectionCard>

        <SectionCard title="Customers">
          <details className="rounded-lg border border-white/10 bg-white/[0.02]">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-white">Customer directory <span className="ml-2 text-xs font-normal text-zinc-500">{customers.length} customers</span></summary>
            <div className="max-h-72 overflow-y-auto border-t border-white/10 p-2">{customers.length === 0 ? <p className="p-2 text-sm text-zinc-500">No customers yet.</p> : customers.map((customer) => <Link key={customer.id} href={`/customers/${customer.id}`} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-white/[0.05]"><span className="truncate text-white">{customer.name}</span><span className="truncate text-xs text-zinc-500">{customer.address ?? "No address"}</span></Link>)}</div>
          </details>
        </SectionCard>
      </div>
    </AppShell>
  );
}
