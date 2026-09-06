import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, FileDown, FileText, ReceiptText, Search } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { InvoiceAdminControls } from "@/components/invoice-admin-controls";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getInvoiceCenterData, type InvoiceCenterRow } from "@/lib/chillbros/billing-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { PAYMENT_TERMS_LABELS } from "@/lib/chillbros/types";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ q?: string; status?: string }> };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const FILTERS = [
  ["all", "All"],
  ["draft", "Draft"],
  ["awaiting", "Awaiting approval"],
  ["approved_unpaid", "Approved / unpaid"],
  ["overdue", "Overdue"],
  ["paid", "Paid"],
  ["void", "Void"],
] as const;

function date(value: string | null) { return value ? new Date(value).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" }) : "—"; }
function time(value: string | null) { return value ? new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"; }
function visible(row: InvoiceCenterRow, filter: string, query: string) {
  const statusMatch = filter === "all" ||
    (filter === "draft" && row.status === "draft") ||
    (filter === "awaiting" && row.status === "awaiting_approval") ||
    (filter === "approved_unpaid" && row.status === "approved" && row.paymentStatus !== "paid") ||
    (filter === "overdue" && row.daysOverdue > 0) ||
    (filter === "paid" && row.paymentStatus === "paid") ||
    (filter === "void" && row.status === "void");
  if (!statusMatch) return false;
  if (!query) return true;
  const haystack = [row.invoiceNumber, row.customerName, row.customerEmail, row.customerPhone, row.jobLocation, row.jobScope, row.technicianName, ...row.equipment].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
}

export default async function InvoicesPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const params = await searchParams;
  const filter = FILTERS.some(([value]) => value === params.status) ? String(params.status) : "all";
  const query = String(params.q || "").trim().toLowerCase();
  const { rows, metrics } = await getInvoiceCenterData();
  const filtered = rows.filter((row) => visible(row, filter, query));
  const canManage = profile.role === "manager";

  return <AppShell title="Invoice Center" description="Search, send, age, archive, collect, and audit every estimate and invoice from one billing workspace." highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Billing pulse</p><StatusPill tone={metrics.overdueValue > 0 ? "amber" : "emerald"}>{money.format(metrics.outstandingValue)} outstanding</StatusPill><StatusPill tone="emerald">{money.format(metrics.collectedThisMonth)} collected this month</StatusPill></div>}>
    <div className="space-y-5">
      <SectionCard eyebrow="Receivables" title="Billing dashboard" description="Live collection and aging numbers. No partial-payment ledger is used; paid invoices close as one full payment.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[
            ["Outstanding", money.format(metrics.outstandingValue)],
            ["Due today", String(metrics.dueToday)],
            ["Overdue", money.format(metrics.overdueValue)],
            ["Collected month", money.format(metrics.collectedThisMonth)],
            ["Awaiting approval", String(metrics.pendingApproval)],
            ["Avg days to pay", metrics.averageDaysToPay.toFixed(1)],
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-xl font-semibold text-white">{value}</p></div>)}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Find" title="Invoice search and status" description="Search invoice number, customer, job, technician, location, or equipment.">
        <form className="flex flex-col gap-2 sm:flex-row" action="/invoices" method="get">
          <input type="hidden" name="status" value={filter} />
          <label className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" /><input name="q" defaultValue={params.q ?? ""} placeholder="Search invoices..." className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 py-2.5 pl-10 pr-3 text-white" /></label>
          <button type="submit" className="rounded-xl border border-[#2d7dff]/30 px-4 py-2.5 text-sm text-[#d9fbff]">Search</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">{FILTERS.map(([value, label]) => <Link key={value} href={`/invoices?status=${value}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`} className={`rounded-full border px-3 py-1.5 text-xs ${filter === value ? "border-[#8ffafa]/60 bg-[#2d7dff]/20 text-white" : "border-[#2d7dff]/20 text-zinc-400"}`}>{label}</Link>)}</div>
      </SectionCard>

      <SectionCard eyebrow="Ledger" title={`${filtered.length} invoice${filtered.length === 1 ? "" : "s"}`} description="Every card includes customer delivery, due/aging state, job lineage, equipment context, document archives, and role-restricted controls.">
        {filtered.length === 0 ? <p className="text-sm text-zinc-400">No invoices match this view.</p> : <div className="space-y-4">{filtered.map((row) => {
          const paid = row.paymentStatus === "paid";
          const approved = row.status === "approved";
          const tone = paid ? "emerald" : row.daysOverdue > 0 ? "amber" : approved ? "emerald" : row.status === "void" ? undefined : "amber";
          return <article key={row.id} className="rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/75 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{row.invoiceNumber}</p><h3 className="mt-1 text-lg font-semibold text-white">{row.customerName}</h3><p className="mt-1 text-xs text-zinc-500">Updated {time(row.updatedAt)}</p></div>
              <div className="text-right"><p className="text-2xl font-semibold text-[#bafcfc]">{money.format(row.total)}</p><div className="mt-2 flex flex-wrap justify-end gap-2"><StatusPill tone={tone}>{paid ? "Paid" : row.status.replace(/_/g, " ")}</StatusPill>{row.daysOverdue > 0 ? <StatusPill tone="amber">{row.daysOverdue}d overdue</StatusPill> : null}</div></div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-[#2d7dff]/10 bg-black/35 p-3"><p className="text-xs text-zinc-500">Billing</p><p className="mt-1 text-sm text-white">{PAYMENT_TERMS_LABELS[row.paymentTerms]}</p><p className="mt-1 text-xs text-zinc-400">Due {date(row.dueAt)} · Aging {row.agingBucket}</p><p className="mt-1 text-xs text-zinc-500">Tax {row.taxRate}% · {money.format(row.taxAmount)}</p></div>
              <div className="rounded-xl border border-[#2d7dff]/10 bg-black/35 p-3"><p className="text-xs text-zinc-500">Customer</p><p className="mt-1 text-sm text-white">{row.customerEmail ?? "No email"}</p><p className="mt-1 text-xs text-zinc-400">{row.customerPhone ?? "No phone"}</p>{row.customerTaxExempt ? <p className="mt-1 text-xs text-amber-100">Tax exempt{row.customerTaxExemptNote ? ` · ${row.customerTaxExemptNote}` : ""}</p> : null}</div>
              <div className="rounded-xl border border-[#2d7dff]/10 bg-black/35 p-3"><p className="text-xs text-zinc-500">Service-call lineage</p><p className="mt-1 text-sm text-white">{row.jobLocation ?? "No job location"}</p><p className="mt-1 text-xs text-zinc-400">{row.technicianName ?? "No technician"}{row.jobStatus ? ` · ${row.jobStatus.replace(/_/g, " ")}` : ""}</p>{row.jobScope ? <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{row.jobScope}</p> : null}</div>
              <div className="rounded-xl border border-[#2d7dff]/10 bg-black/35 p-3"><p className="text-xs text-zinc-500">Equipment</p>{row.equipment.length ? row.equipment.map((item) => <p key={item} className="mt-1 text-xs text-zinc-300">{item}</p>) : <p className="mt-1 text-xs text-zinc-500">No customer equipment linked.</p>}</div>
            </div>

            <div className="mt-3 grid gap-2 rounded-xl border border-[#2d7dff]/10 bg-black/25 p-3 text-xs sm:grid-cols-4"><div><span className="text-zinc-500">Subtotal</span><p className="mt-1 text-white">{money.format(row.subtotal)}</p></div><div><span className="text-zinc-500">Discount</span><p className="mt-1 text-emerald-200">−{money.format(row.discountAmount)}</p></div><div><span className="text-zinc-500">Credits / refunds</span><p className="mt-1 text-white">{money.format(row.creditAmount)} / {money.format(row.refundAmount)}</p></div><div><span className="text-zinc-500">Reminders</span><p className="mt-1 text-white">{row.reminderCount}{row.lastReminderAt ? ` · ${date(row.lastReminderAt)}` : ""}</p></div></div>

            {row.adjustments.length ? <details className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/5 p-3"><summary className="cursor-pointer text-xs font-medium text-amber-100">Credit / refund audit ({row.adjustments.length})</summary><div className="mt-2 space-y-2">{row.adjustments.map((entry) => <div key={entry.id} className="flex flex-wrap justify-between gap-2 border-t border-amber-400/10 pt-2 text-xs"><span className="text-zinc-300">{entry.type.toUpperCase()} · {entry.reason}</span><span className="text-amber-100">{money.format(entry.amount)} · {date(entry.createdAt)}</span></div>)}</div></details> : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {row.status !== "void" ? <Link href={`/portal/${row.portalToken}`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff]"><ExternalLink className="h-3.5 w-3.5" />Customer view</Link> : null}
              {row.status !== "void" ? <Link href={`/portal/${row.portalToken}/document`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff]"><FileText className="h-3.5 w-3.5" />Document</Link> : null}
              {row.hasApprovedArchive ? <Link href={`/api/portal/${row.portalToken}/pdf?stage=approved`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff]"><FileDown className="h-3.5 w-3.5" />Approved PDF</Link> : null}
              {row.hasPaidArchive ? <Link href={`/api/portal/${row.portalToken}/pdf?stage=paid`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 px-3 py-2 text-xs text-emerald-100"><FileDown className="h-3.5 w-3.5" />Paid PDF</Link> : null}
              {row.receiptNumber ? <Link href={`/portal/${row.portalToken}/receipt`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 px-3 py-2 text-xs text-emerald-100"><ReceiptText className="h-3.5 w-3.5" />Receipt {row.receiptNumber}</Link> : null}
            </div>
            {row.latestDelivery ? <p className="mt-3 text-[11px] text-zinc-500">Latest delivery: {row.latestDelivery.type} by {row.latestDelivery.channel} · {row.latestDelivery.status} · {time(row.latestDelivery.createdAt)}</p> : null}

            <div className="mt-4 border-t border-[#2d7dff]/10 pt-4"><InvoiceAdminControls invoiceId={row.id} status={row.status} paymentStatus={row.paymentStatus} taxRate={row.taxRate} paymentTerms={row.paymentTerms} dueAt={row.dueAt} taxExempt={row.customerTaxExempt} taxExemptNote={row.customerTaxExemptNote} hasApprovedArchive={row.hasApprovedArchive} hasPaidArchive={row.hasPaidArchive} canManage={canManage} /></div>
          </article>;
        })}</div>}
      </SectionCard>
    </div>
  </AppShell>;
}
