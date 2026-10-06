import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, BellRing, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, CreditCard, Package, PackageCheck, Plus, X } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EN_ROUTE_STATUSES, JobStatusChip, ON_SITE_STATUSES } from "@/components/job-status-chip";
import { getInvoiceCenterData } from "@/lib/chillbros/billing-queries";
import { getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCalendarJobs } from "@/lib/chillbros/schedule-queries";
import { ctToday, displayTime, parseWindow } from "@/lib/chillbros/schedule-window";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { clearAllOwnerPaymentNotificationsAction, clearOwnerPaymentNotificationAction } from "@/app/owner-home-actions";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const CLOSED_STATUSES = ["paid", "completed", "cancelled"];

function attentionMeta(stage: string, status: string) {
  if (stage === "approved_needs_action" || stage === "approved") return { priority: 1, label: "Approved · choose work or return visit", tone: "text-[#0A7FC2]", icon: CheckCircle2 };
  if (stage === "payment_method_selected") return { priority: 2, label: "Manual payment needs verification", tone: "text-[#1B3FD0]", icon: CreditCard };
  if (stage === "invoice_issued") return { priority: 3, label: "Invoice issued · awaiting payment", tone: "text-[#1B3FD0]", icon: CreditCard };
  if (stage === "estimate_published" || stage === "awaiting_approval") return { priority: 4, label: "Estimate awaiting customer approval", tone: "text-[#1B3FD0]", icon: ClipboardList };
  if (stage === "return_scheduled") return { priority: 5, label: "Return visit scheduled", tone: "text-[#1B3FD0]", icon: CalendarDays };
  if (stage === "approved_work_now") return { priority: 6, label: "Approved work in progress", tone: "text-[#1B3FD0]", icon: ClipboardList };
  if (status === "completed" && stage === "completed") return { priority: 7, label: "Completed call · review billing", tone: "text-[#2B3F5C]", icon: AlertCircle };
  return null;
}

function StatCard({ href, label, value, valueClass = "text-[#0A1A33]", hint, hintClass = "text-[#2B3F5C]" }: { href: string; label: string; value: string; valueClass?: string; hint: string; hintClass?: string }) {
  return (
    <Link href={href} className="cb-card block min-h-[112px] p-3.5 transition hover:border-[#1B3FD0]">
      <p className="text-[13px] font-medium text-[#2B3F5C]">{label}</p>
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

  const invoiceByJob = new Map(invoiceRows.filter((row) => row.jobId && !row.convertedInvoiceId).map((row) => [row.jobId as string, row]));
  const approvedQuoteQueue = lifecycleJobs
    .map((job) => ({ job, invoice: invoiceByJob.get(job.id) }))
    .filter((entry) => {
      if (!entry.invoice || entry.invoice.status !== "approved" || entry.invoice.issuedAt) return false;
      return entry.job.status === "parts_required"
        || entry.job.status === "return_visit_needed"
        || entry.job.workflowStage === "approved_needs_action"
        || String(entry.job.scheduledWindow ?? "").toLowerCase().includes("needs scheduling");
    })
    .sort((a, b) => new Date(b.invoice!.updatedAt).getTime() - new Date(a.invoice!.updatedAt).getTime())
    .slice(0, 8);

  const waitingForPayment = invoiceRows
    .filter((row) => row.status === "approved" && Boolean(row.issuedAt) && row.paymentStatus !== "paid")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  const paidRows = invoiceRows
    .filter((row) => row.paymentStatus === "paid" && row.paidAt)
    .sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime())
    .slice(0, 50);
  const paidIds = paidRows.map((row) => row.id);
  const supabase = createServiceRoleClient();
  const { data: clearedPaymentEvents } = paidIds.length
    ? await supabase
        .from("chillbros_workflow_events")
        .select("invoice_id,created_at")
        .in("invoice_id", paidIds)
        .eq("stage", "owner_payment_notification_cleared")
        .order("created_at", { ascending: false })
    : { data: [] as { invoice_id: string | null; created_at: string }[] };
  const latestClearByInvoice = new Map<string, string>();
  for (const event of clearedPaymentEvents ?? []) {
    if (event.invoice_id && !latestClearByInvoice.has(event.invoice_id)) latestClearByInvoice.set(event.invoice_id, event.created_at);
  }
  const paidNotifications = paidRows.filter((row) => {
    const clearedAt = latestClearByInvoice.get(row.id);
    return !clearedAt || new Date(clearedAt).getTime() < new Date(row.paidAt!).getTime();
  }).slice(0, 8);

  const attention = lifecycleJobs
    .map((job) => ({ job, meta: attentionMeta(job.workflowStage, job.status) }))
    .filter((entry): entry is { job: (typeof lifecycleJobs)[number]; meta: NonNullable<ReturnType<typeof attentionMeta>> } => Boolean(entry.meta))
    .sort((a, b) => a.meta.priority - b.meta.priority)
    .slice(0, 12);

  return (
    <AppShell title="Home" description="One service call record from intake through payment." notificationCount={attention.length + approvedQuoteQueue.length + paidNotifications.length}>
      <div className="cb-new space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <StatCard href="/technician" label="Jobs today" value={String(todaySchedule.length)} hint={`${inProgressToday} in progress`} />
          <StatCard
            href="/dispatch"
            label="Unassigned"
            value={String(unassignedCount)}
            valueClass={unassignedCount > 0 ? "text-[#1B3FD0]" : "text-[#0A1A33]"}
            hint={unassignedCount > 0 ? "Assign now" : "All assigned"}
            hintClass={unassignedCount > 0 ? "text-[#1B3FD0] font-semibold" : "text-[#2B3F5C]"}
          />
          <StatCard
            href="/invoices?status=overdue"
            label="Overdue"
            value={money.format(billingMetrics.overdueValue)}
            valueClass={overdueCount > 0 ? "text-[#1B3FD0]" : "text-[#0A1A33]"}
            hint={`${overdueCount} invoice${overdueCount === 1 ? "" : "s"}`}
          />
          <StatCard href="/invoices" label="Collected this month" value={money.format(billingMetrics.collectedThisMonth)} hint="Paid invoices" />
        </div>

        <section className="cb-card overflow-hidden" aria-labelledby="todays-schedule">
          <div className="flex items-center justify-between gap-3 border-b border-[#0A1A33]/10 px-3.5 py-3">
            <h2 id="todays-schedule" className="text-[28px] leading-none">Today&apos;s schedule</h2>
            <Link href="/schedule" className="inline-flex min-h-11 items-center gap-0.5 px-1 text-sm font-semibold text-[#1B3FD0] hover:text-[#1530A8]">
              View all
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {todaySchedule.length === 0 ? (
            <p className="px-3.5 py-5 text-sm text-[#2B3F5C]">Nothing scheduled for today.</p>
          ) : (
            <ul className="divide-y divide-[#0A1A33]/10">
              {todaySchedule.map(({ job, slot }) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className="flex min-h-[64px] items-center gap-3 px-3.5 py-2.5 transition hover:bg-[#F5F8FC]">
                    <span className="w-[62px] shrink-0 text-sm font-semibold text-[#0A1A33]">{displayTime(slot!.start)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[#0A1A33]">{job.customerName}</span>
                      <span className="block truncate text-[13px] text-[#2B3F5C]">{job.scope?.trim() || "No complaint recorded"}</span>
                    </span>
                    <JobStatusChip status={job.status} assigned={Boolean(job.assignedTechId)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/jobs/new"
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1B3FD0] px-2 text-center text-base font-semibold leading-tight text-white shadow-[0_2px_8px_rgba(10,26,51,0.25)] transition [text-shadow:none] hover:bg-[#1530A8]"
          >
            <Plus className="h-5 w-5 shrink-0" aria-hidden="true" />
            New service call
          </Link>
          <Link
            href="/agreements"
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1B3FD0] px-2 text-center text-base font-semibold leading-tight text-white shadow-[0_2px_8px_rgba(10,26,51,0.25)] transition [text-shadow:none] hover:bg-[#1530A8]"
          >
            <Package className="h-5 w-5 shrink-0" aria-hidden="true" />
            Package deal
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/invoices/new?type=quote" className="flex min-h-[50px] items-center justify-center rounded-xl border-2 border-[#1B3FD0] bg-[#F8FAFD] px-3 text-center text-sm font-bold text-[#1B3FD0] transition hover:bg-[#EAF2FC]">
            + New quote
          </Link>
          <Link href="/invoices/new?type=invoice" className="flex min-h-[50px] items-center justify-center rounded-xl border-2 border-[#1B3FD0] bg-[#F8FAFD] px-3 text-center text-sm font-bold text-[#1B3FD0] transition hover:bg-[#EAF2FC]">
            + New invoice
          </Link>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="cb-card overflow-hidden" aria-labelledby="approved-quote-queue">
            <div className="flex items-center justify-between gap-3 border-b border-[#0A1A33]/10 px-3.5 py-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1B3FD0]">Approved quotes</p>
                <h2 id="approved-quote-queue" className="text-[24px] leading-none">Parts / return scheduling</h2>
              </div>
              <span className="rounded-full bg-[#EAF2FC] px-2.5 py-1 text-sm font-bold text-[#1B3FD0]">{approvedQuoteQueue.length}</span>
            </div>
            {approvedQuoteQueue.length === 0 ? (
              <p className="px-3.5 py-5 text-sm text-[#2B3F5C]">No approved quotes are waiting on parts or a return visit.</p>
            ) : (
              <ul className="divide-y divide-[#0A1A33]/10">
                {approvedQuoteQueue.map(({ job, invoice }) => {
                  const waitingParts = job.status === "parts_required";
                  const reason = waitingParts ? "Waiting for parts" : "Return visit needs scheduling";
                  return (
                    <li key={job.id}>
                      <Link href={`/jobs/${job.id}`} className="flex min-h-[66px] items-start gap-3 px-3.5 py-2.5 transition hover:bg-[#F5F8FC]">
                        <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#1B3FD0]" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate font-semibold text-[#0A1A33]">{job.customerName}</span>
                            <span className="shrink-0 text-xs font-bold text-[#1B3FD0]">{invoice?.invoiceNumber}</span>
                          </span>
                          <span className="block text-[13px] font-semibold text-[#0A7FC2]">{reason}</span>
                          <span className="block truncate text-[13px] text-[#2B3F5C]">{job.scope?.trim() || invoice?.equipment?.[0] || "Open job for details"}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="cb-card overflow-hidden" aria-labelledby="owner-invoice-queue">
            <div className="flex items-center justify-between gap-3 border-b border-[#0A1A33]/10 px-3.5 py-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1B3FD0]">Invoices</p>
                <h2 id="owner-invoice-queue" className="text-[24px] leading-none">Payment status</h2>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="rounded-full bg-[#FFF4D6] px-2.5 py-1 text-[#7A5400]">{waitingForPayment.length} waiting</span>
                {paidNotifications.length > 0 ? <span className="rounded-full bg-[#E6F7EF] px-2.5 py-1 text-[#087A4B]">{paidNotifications.length} paid</span> : null}
              </div>
            </div>

            {waitingForPayment.length === 0 && paidNotifications.length === 0 ? (
              <p className="px-3.5 py-5 text-sm text-[#2B3F5C]">No payment items need your attention.</p>
            ) : (
              <div>
                {waitingForPayment.length > 0 ? (
                  <div>
                    <p className="border-b border-[#0A1A33]/10 bg-[#FFF9E8] px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#7A5400]">Waiting for payment</p>
                    <ul className="divide-y divide-[#0A1A33]/10">
                      {waitingForPayment.map((invoice) => (
                        <li key={invoice.id}>
                          <Link href={`/invoices?focus=${invoice.id}`} className="flex min-h-[62px] items-start gap-3 px-3.5 py-2.5 transition hover:bg-[#F5F8FC]">
                            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-[#1B3FD0]" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate font-semibold text-[#0A1A33]">{invoice.customerName}</span>
                                <span className="shrink-0 font-bold text-[#0A1A33]">{money.format(invoice.total)}</span>
                              </span>
                              <span className="block text-[13px] text-[#2B3F5C]">{invoice.invoiceNumber} · {invoice.daysOverdue > 0 ? `${invoice.daysOverdue} day${invoice.daysOverdue === 1 ? "" : "s"} overdue` : "Awaiting payment"}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {paidNotifications.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between border-y border-[#0A1A33]/10 bg-[#EEF9F4] px-3.5 py-2">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#087A4B]">Payment complete</p>
                      <form action={clearAllOwnerPaymentNotificationsAction}>
                        <button type="submit" className="text-xs font-bold text-[#1B3FD0] hover:underline">Clear all</button>
                      </form>
                    </div>
                    <ul className="divide-y divide-[#0A1A33]/10">
                      {paidNotifications.map((invoice) => (
                        <li key={invoice.id} className="flex min-h-[62px] items-start gap-2 px-3.5 py-2.5">
                          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-[#087A4B]" aria-hidden="true" />
                          <Link href={`/invoices?focus=${invoice.id}`} className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate font-semibold text-[#0A1A33]">{invoice.customerName}</span>
                              <span className="shrink-0 font-bold text-[#087A4B]">{money.format(invoice.total)}</span>
                            </span>
                            <span className="block text-[13px] text-[#2B3F5C]">{invoice.invoiceNumber} · Payment complete</span>
                          </Link>
                          <form action={clearOwnerPaymentNotificationAction}>
                            <input type="hidden" name="invoiceId" value={invoice.id} />
                            <button type="submit" title="Clear payment notification" aria-label={`Clear paid notification for ${invoice.invoiceNumber}`} className="rounded-lg p-2 text-[#2B3F5C] transition hover:bg-[#EAF2FC] hover:text-[#1B3FD0]">
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>

        <section id="needs-attention" className="cb-card hidden scroll-mt-4 overflow-hidden target:block" aria-labelledby="needs-attention-title">
          <h2 id="needs-attention-title" className="border-b border-[#0A1A33]/10 px-3.5 py-3 text-[28px] leading-none">Needs attention</h2>
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 px-3.5 py-5 text-sm text-[#0A7FC2]">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              No workflow handoffs are waiting on you.
            </p>
          ) : (
            <ul className="divide-y divide-[#0A1A33]/10">
              {attention.map(({ job, meta }) => {
                const Icon = meta.icon;
                return (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.id}`} className="flex min-h-[64px] items-start gap-3 px-3.5 py-2.5 transition hover:bg-[#F5F8FC]">
                      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.tone}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-[#0A1A33]">{job.customerName}</span>
                        <span className={`block text-[13px] font-medium ${meta.tone}`}>{meta.label}</span>
                        <span className="block truncate text-[13px] text-[#2B3F5C]">{job.location || "No location"} · {job.assignedTechName || "Unassigned"}</span>
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
