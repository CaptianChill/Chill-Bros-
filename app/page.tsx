import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, CalendarDays, CheckCircle2, ClipboardList, CreditCard, Mail } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { LogoBadge } from "@/components/logo-badge";
import { SectionCard } from "@/components/section-card";
import { getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCustomers, getDashboardMetrics, getEmailLog } from "@/lib/chillbros/queries";
import { getCalendarJobs } from "@/lib/chillbros/schedule-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

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
  if (stage === "return_scheduled") return { priority: 5, label: "Return visit scheduled", tone: "text-[#bafcfc]", icon: CalendarDays };
  if (stage === "approved_work_now") return { priority: 6, label: "Approved work in progress", tone: "text-[#bafcfc]", icon: ClipboardList };
  if (status === "completed" && stage === "completed") return { priority: 7, label: "Completed call · review billing", tone: "text-zinc-200", icon: AlertCircle };
  return null;
}

export default async function HomePage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role === "technician") redirect("/technician");
  if (profile.role === "office") redirect("/office");

  const [metrics, rawCustomers, emailLog, jobs, lifecycleJobs] = await Promise.all([
    getDashboardMetrics(),
    getCustomers(),
    getEmailLog(5),
    getCalendarJobs(),
    getDispatchJobs(150),
  ]);

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

  const dashboardMetrics = [
    { label: "Open dispatch jobs", value: String(metrics.openJobs), href: "/operations?view=dispatch" },
    { label: "Approvals today", value: String(metrics.approvalsToday), href: "/operations?view=approvals" },
    { label: "Inventory alerts", value: String(metrics.lowStockParts), href: "/operations?view=inventory" },
    { label: "Communication today", value: String(metrics.emailEventsToday), href: "/operations?view=communications" },
  ];

  const scheduleTile = ({ job, slot }: (typeof todaySchedule)[number]) => (
    <Link key={job.id} href={`/jobs/${job.id}`} className="min-w-0 rounded-lg border border-[#2d7dff]/20 bg-black/45 p-2 transition hover:border-[#8ffafa]/45 hover:bg-[#2d7dff]/10">
      <p className="truncate text-[11px] font-semibold text-[#8ffafa]">{displayTime(slot!.start)}</p>
      <p className="mt-0.5 truncate text-[11px] font-semibold text-white">{job.customerName}</p>
      <p className="mt-0.5 truncate text-[10px] text-zinc-400">{job.location || "No location"}</p>
      <p className="truncate text-[10px] text-zinc-500">{job.assignedTechName || "Unassigned"}</p>
    </Link>
  );

  return <AppShell title="One job record from service call through payment." highlight={<div className="flex h-full flex-col justify-between gap-3"><div><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Owner command center</p><p className="mt-2 text-sm leading-6 text-zinc-300">The dashboard now prioritizes the next action: approval, return visit, invoice, or payment.</p></div><LogoBadge variant="full" className="mx-auto w-full max-w-[10rem]" /></div>}>
    <div className="space-y-4">
      <SectionCard title="Needs attention">
        {attention.length === 0 ? <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-100"><CheckCircle2 className="h-5 w-5" />No workflow handoffs are waiting on you.</div> : <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{attention.map(({ job, meta }) => {
          const Icon = meta.icon;
          return <Link key={job.id} href={`/jobs/${job.id}`} className="rounded-xl border border-[#2d7dff]/20 bg-black/45 p-3 transition hover:border-[#8ffafa]/50 hover:bg-[#2d7dff]/10"><div className="flex items-start gap-3"><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.tone}`} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{job.customerName}</p><p className={`mt-1 text-xs font-medium ${meta.tone}`}>{meta.label}</p><p className="mt-1 truncate text-[11px] text-zinc-500">{job.location || "No location"} · {job.assignedTechName || "Unassigned"}</p></div></div></Link>;
        })}</div>}
      </SectionCard>

      <SectionCard title="Today">
        <div className="mb-2 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-zinc-300"><CalendarDays className="h-4 w-4 text-[#8ffafa]" /><span>{todaySchedule.length} scheduled</span></div><Link href="/schedule" className="rounded-lg border border-[#2d7dff]/25 px-3 py-1.5 text-xs font-semibold text-[#d9fbff]">Open Schedule</Link></div>
        {todaySchedule.length === 0 ? <p className="rounded-xl border border-dashed border-[#2d7dff]/20 p-3 text-sm text-zinc-500">Nothing scheduled for today.</p> : <><div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">{visibleToday.map(scheduleTile)}</div>{extraToday.length > 0 ? <details className="mt-2 rounded-lg border border-[#2d7dff]/15 bg-black/30"><summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold text-[#d9fbff]">Show {extraToday.length} more today</summary><div className="grid grid-cols-2 gap-1.5 border-t border-[#2d7dff]/15 p-2 sm:grid-cols-4 lg:grid-cols-7">{extraToday.map(scheduleTile)}</div></details> : null}</>}
      </SectionCard>

      <SectionCard title="Operational pulse"><div className="grid grid-cols-2 gap-2 xl:grid-cols-4">{dashboardMetrics.map((metric) => <Link key={metric.label} href={metric.href} className="rounded-xl border border-[#2d7dff]/25 bg-black/40 p-3 transition hover:border-[#8ffafa]/45 hover:bg-[#2d7dff]/10"><p className="text-[11px] leading-4 text-zinc-400">{metric.label}</p><p className="mt-1.5 text-2xl font-semibold leading-none text-white">{metric.value}</p></Link>)}</div></SectionCard>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <SectionCard title="Customers"><details className="rounded-xl border border-[#2d7dff]/20 bg-black/40"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-white">Customer directory <span className="ml-2 text-xs font-normal text-zinc-500">{customers.length} customers</span></summary><div className="max-h-72 overflow-y-auto border-t border-[#2d7dff]/15 p-2">{customers.length === 0 ? <p className="p-2 text-sm text-zinc-500">No customers yet.</p> : customers.map((customer) => <Link key={customer.id} href={`/customers/${customer.id}`} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-[#2d7dff]/10"><span className="truncate text-white">{customer.name}</span><span className="truncate text-xs text-zinc-500">{customer.address ?? "No address"}</span></Link>)}</div></details></SectionCard>
        <SectionCard title="Recent communication"><div className="space-y-2 text-sm text-zinc-300">{emailLog.length === 0 ? <Link href="/operations?view=communications" className="flex items-center gap-3 rounded-xl border border-[#2d7dff]/20 bg-black/40 p-3"><Mail className="h-4 w-4 shrink-0 text-[#8ffafa]" /><span>No communication events logged yet.</span></Link> : emailLog.slice(0, 4).map((entry) => <Link key={entry.id} href="/operations?view=communications" className="flex items-center gap-3 rounded-xl border border-[#2d7dff]/20 bg-black/40 p-3 transition hover:bg-[#2d7dff]/10"><ClipboardList className="h-4 w-4 shrink-0 text-[#8ffafa]" /><div className="min-w-0"><p className="truncate text-white">{entry.subject}</p><p className="truncate text-xs text-zinc-500">{entry.recipients}</p></div></Link>)}</div></SectionCard>
      </div>
    </div>
  </AppShell>;
}
