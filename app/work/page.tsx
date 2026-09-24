import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ChevronRight, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { JobStatusChip } from "@/components/job-status-chip";
import { getInvoiceCenterData, type InvoiceCenterRow } from "@/lib/chillbros/billing-queries";
import { getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { displayTime, parseWindow } from "@/lib/chillbros/schedule-window";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ saved?: string }> };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const CLOSED_STATUSES = ["paid", "completed", "cancelled"];

function when(scheduledWindow: string | null) {
  const slot = parseWindow(scheduledWindow);
  if (!slot) return "No time set";
  const day = new Date(`${slot.date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${displayTime(slot.start)}`;
}

function Section({ id, title, count, empty, children }: { id: string; title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="cb-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[#0A1A33]/10 px-3.5 py-3">
        <h2 id={id} className="text-[28px] leading-none">{title}</h2>
        <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-[#1557B0] px-2.5 py-1 text-sm font-bold text-white">{count}</span>
      </div>
      {count === 0 ? <p className="bg-[#F8FAFD] px-3.5 py-4 text-sm font-medium text-[#2B3F5C]">{empty}</p> : <ul className="divide-y divide-[#0A1A33]/10">{children}</ul>}
    </section>
  );
}

function Row({ href, title, detail, right, highlight = false }: { href: string; title: string; detail: string; right: React.ReactNode; highlight?: boolean }) {
  return (
    <li>
      <Link href={href} className={`flex min-h-[64px] items-center gap-3 px-3.5 py-2.5 transition hover:bg-white ${highlight ? "bg-[#DCEBFF]" : "bg-[#F8FAFD]"}`}>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-[#0A1A33]">{title}</span>
          <span className="block truncate text-[13px] font-medium text-[#2B3F5C]">{detail}</span>
        </span>
        <span className="shrink-0">{right}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-[#2B3F5C]" aria-hidden="true" />
      </Link>
    </li>
  );
}

const amount = (row: InvoiceCenterRow) => <span className="text-sm font-bold text-[#0A1A33]">{money.format(row.total)}</span>;

// Everything not finished yet, in one place: saved calls, quotes and invoices.
export default async function OpenWorkPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role === "technician") redirect("/technician");
  if (!["manager", "office"].includes(profile.role)) redirect("/");

  const [{ saved }, jobs, invoiceCenter] = await Promise.all([
    searchParams,
    getDispatchJobs(250),
    getInvoiceCenterData().catch(() => ({ rows: [] as InvoiceCenterRow[] })),
  ]);
  const rows = invoiceCenter.rows.filter((row) => row.status !== "void" && row.paymentStatus !== "paid");
  const jobsWithDocument = new Set(invoiceCenter.rows.filter((row) => row.status !== "void").map((row) => row.jobId));

  // Open calls with no quote or invoice yet.
  const calls = jobs.filter((job) => !CLOSED_STATUSES.includes(job.status) && !jobsWithDocument.has(job.id));
  // Quotes: sent and waiting on the customer.
  const quotes = rows.filter((row) => !row.issuedAt && row.status !== "approved");
  // Invoices: approved work not invoiced yet, then issued and unpaid.
  const toInvoice = rows.filter((row) => !row.issuedAt && row.status === "approved");
  const unpaid = rows.filter((row) => row.issuedAt).sort((a, b) => b.daysOverdue - a.daysOverdue);
  const savedJob = saved ? jobs.find((job) => job.id === saved) : undefined;

  return (
    <AppShell title="Open work" description="Saved calls, quotes and invoices that still need finishing.">
      <div className="cb-new space-y-3.5">
        {savedJob ? (
          <p role="status" className="cb-card flex items-center gap-2 p-3.5 font-semibold text-[#0A1A33]">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0A7FC2]" aria-hidden="true" />
            Saved the call for {savedJob.customerName}.
          </p>
        ) : null}

        <Link href="/jobs/new" className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1557B0] text-base font-semibold text-white shadow-[0_2px_8px_rgba(10,26,51,0.25)] transition hover:bg-[#0E3F82]">
          <Plus className="h-5 w-5" aria-hidden="true" />
          New service call
        </Link>

        <Section id="open-calls" title="Service calls" count={calls.length} empty="No open calls without a quote.">
          {calls.map((job) => (
            <Row key={job.id} href={`/jobs/${job.id}`} highlight={job.id === saved} title={job.customerName} detail={`${when(job.scheduledWindow)} · ${job.assignedTechName ?? "Unassigned"} · ${job.scope?.trim() || "No complaint recorded"}`} right={<JobStatusChip status={job.status} assigned={Boolean(job.assignedTechId)} />} />
          ))}
        </Section>

        <Section id="open-quotes" title="Quotes" count={quotes.length} empty="No quotes waiting on a customer.">
          {quotes.map((row) => (
            <Row key={row.id} href={row.jobId ? `/jobs/${row.jobId}/quote` : `/invoices?focus=${row.id}`} title={row.customerName} detail={`${row.invoiceNumber} · ${row.status === "draft" ? "Draft" : "Waiting on customer"}`} right={amount(row)} />
          ))}
        </Section>

        <Section id="open-invoices" title="Invoices" count={toInvoice.length + unpaid.length} empty="Nothing to invoice or collect.">
          {toInvoice.map((row) => (
            <Row key={row.id} href={row.jobId ? `/jobs/${row.jobId}` : `/invoices?focus=${row.id}`} title={row.customerName} detail={`${row.invoiceNumber} · Approved · invoice when work is done`} right={amount(row)} />
          ))}
          {unpaid.map((row) => (
            <Row key={row.id} href={`/invoices?focus=${row.id}`} title={row.customerName} detail={`${row.invoiceNumber} · ${row.daysOverdue > 0 ? `${row.daysOverdue} days overdue` : "Unpaid"}`} right={amount(row)} />
          ))}
        </Section>
      </div>
    </AppShell>
  );
}
