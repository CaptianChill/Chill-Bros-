import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, FileDown, FileText, Plus, ReceiptText, Search } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { OwnerEstimateEditor } from "@/components/owner-estimate-editor";
import { getInvoiceV2ById } from "@/lib/chillbros/invoice-v2";
import { InvoiceAdminControls } from "@/components/invoice-admin-controls";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getInvoiceCenterData, type InvoiceCenterRow } from "@/lib/chillbros/billing-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { PAYMENT_TERMS_LABELS } from "@/lib/chillbros/types";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ q?: string; status?: string; focus?: string; edit?: string; success?: string; error?: string; missingEmail?: string }> };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const FILTERS = [["active","Active"],["draft","Draft"],["awaiting","Awaiting approval"],["approved_unpaid","Approved / unpaid"],["overdue","Overdue"],["archive","Archive"]] as const;
function date(value: string | null) { return value ? new Date(value).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" }) : "—"; }
function time(value: string | null) { return value ? new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"; }
function isArchived(row: InvoiceCenterRow) { return row.paymentStatus === "paid" || row.status === "void"; }
function visible(row: InvoiceCenterRow, filter: string, query: string) {
  const statusMatch = filter === "active" ? !isArchived(row)
    : filter === "draft" ? row.status === "draft"
    : filter === "awaiting" ? row.status === "awaiting_approval"
    : filter === "approved_unpaid" ? row.status === "approved" && row.paymentStatus !== "paid"
    : filter === "overdue" ? row.daysOverdue > 0
    : filter === "archive" ? isArchived(row)
    : !isArchived(row);
  if (!statusMatch) return false;
  if (!query) return true;
  return [row.invoiceNumber,row.customerName,row.customerEmail,row.customerPhone,row.jobLocation,row.jobScope,row.technicianName,...row.equipment].filter(Boolean).join(" ").toLowerCase().includes(query);
}

export default async function InvoicesPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile(); if (!profile || !["manager","office"].includes(profile.role)) redirect("/");
  const params = await searchParams;
  const editInvoice = profile.role === "manager" && params.focus && params.edit === "1" ? await getInvoiceV2ById(params.focus) : null;
  const filter = FILTERS.some(([value]) => value === params.status) ? String(params.status) : "active";
  const query = String(params.q || "").trim().toLowerCase();
  const { rows, metrics } = await getInvoiceCenterData();
  const focused = params.focus ? rows.find((row) => row.id === params.focus) ?? null : null;
  const filtered = focused ? [focused] : rows.filter((row) => visible(row, filter, query));
  const activeCount = rows.filter((row) => !isArchived(row)).length;
  const archiveCount = rows.length - activeCount;
  const canManage = profile.role === "manager";

  const renderCard = (row: InvoiceCenterRow, simple = false) => {
    const paid = row.paymentStatus === "paid"; const approved = row.status === "approved";
    const tone = paid ? "emerald" : row.daysOverdue > 0 ? "amber" : approved ? "emerald" : row.status === "void" ? undefined : "amber";
    return <article key={row.id} className={`rounded-2xl border ${simple ? "border-[#8ffafa]/40 bg-[#06111b]/95" : "border-[#2d7dff]/20 bg-zinc-950/75"} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{row.invoiceNumber}</p><h3 className="mt-1 text-lg font-semibold text-white">{row.customerName}</h3><p className="mt-1 text-xs text-zinc-500">Updated {time(row.updatedAt)}</p></div><div className="text-right"><p className="text-2xl font-semibold text-[#bafcfc]">{money.format(row.total)}</p><div className="mt-2"><StatusPill tone={tone}>{paid ? "Paid" : row.status.replace(/_/g," ")}</StatusPill></div></div></div>
      {!simple ? <div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-[#2d7dff]/10 bg-black/35 p-3"><p className="text-xs text-zinc-500">Billing</p><p className="mt-1 text-sm text-white">{PAYMENT_TERMS_LABELS[row.paymentTerms]}</p><p className="mt-1 text-xs text-zinc-400">Due {date(row.dueAt)} · Aging {row.agingBucket}</p></div><div className="rounded-xl border border-[#2d7dff]/10 bg-black/35 p-3"><p className="text-xs text-zinc-500">Customer</p><p className="mt-1 text-sm text-white">{row.customerEmail ?? "No email"}</p><p className="mt-1 text-xs text-zinc-400">{row.customerPhone ?? "No phone"}</p></div><div className="rounded-xl border border-[#2d7dff]/10 bg-black/35 p-3"><p className="text-xs text-zinc-500">Service</p><p className="mt-1 text-sm text-white">{row.jobLocation ?? "Direct invoice"}</p></div></div> : null}
      <div className="mt-3 flex flex-wrap gap-2">{row.status !== "void" ? <Link href={`/portal/${row.portalToken}/document`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff]"><FileText className="h-3.5 w-3.5" />Document</Link> : null}{row.status !== "void" ? <Link href={`/portal/${row.portalToken}`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff]"><ExternalLink className="h-3.5 w-3.5" />Customer view</Link> : null}{row.hasApprovedArchive ? <Link href={`/api/portal/${row.portalToken}/pdf?stage=approved`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff]"><FileDown className="h-3.5 w-3.5" />PDF</Link> : null}{row.receiptNumber ? <Link href={`/portal/${row.portalToken}/receipt`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 px-3 py-2 text-xs text-emerald-100"><ReceiptText className="h-3.5 w-3.5" />Receipt</Link> : null}</div>
      <div className="mt-4 border-t border-[#2d7dff]/10 pt-4"><InvoiceAdminControls invoiceId={row.id} status={row.status} paymentStatus={row.paymentStatus} taxRate={row.taxRate} paymentTerms={row.paymentTerms} dueAt={row.dueAt} taxExempt={row.customerTaxExempt} taxExemptNote={row.customerTaxExemptNote} hasApprovedArchive={row.hasApprovedArchive} hasPaidArchive={row.hasPaidArchive} canManage={canManage} missingEmail={params.missingEmail === row.id} /></div>
    </article>;
  };

  return <AppShell title="Invoice Center" description="Active billing stays here. Paid and void documents are tucked into customer history and the archive view.">
    <div className="space-y-5">
      {params.success ? <p className="text-sm text-emerald-200">{params.success}</p> : null}
      {params.error ? <p className="text-sm text-rose-200">{params.error}</p> : null}
      {editInvoice && ["draft", "awaiting_approval"].includes(editInvoice.status) && editInvoice.paymentStatus !== "paid" ? <OwnerEstimateEditor key={editInvoice.id} invoice={editInvoice} /> : null}
      {focused ? <><section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/[0.06] p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Document ready</p><h2 className="mt-1 text-2xl font-semibold text-white">Open and send</h2></section>{renderCard(focused,true)}<div className="flex gap-2"><Link href="/invoices/new?type=invoice" className="rounded-xl border border-[#8ffafa]/35 px-4 py-3 text-sm text-white"><Plus className="mr-1 inline h-4 w-4"/>New invoice</Link><Link href="/invoices" className="rounded-xl border border-[#2d7dff]/25 px-4 py-3 text-sm text-zinc-300">Back</Link></div></> : <>
        <div className="grid gap-3 sm:grid-cols-2"><Link href="/invoices/new?type=invoice" className="rounded-2xl border border-[#8ffafa]/45 bg-[#2d7dff]/15 p-4 text-center font-semibold text-white">+ New Invoice</Link><Link href="/invoices/new?type=quote" className="rounded-2xl border border-[#2d7dff]/25 p-4 text-center font-semibold text-[#d9fbff]">+ New Quote</Link></div>
        <SectionCard eyebrow="Receivables" title="Billing dashboard" description="Only active work stays in your face."><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Active",String(activeCount)],["Outstanding",money.format(metrics.outstandingValue)],["Overdue",money.format(metrics.overdueValue)],["Archived",String(archiveCount)]].map(([l,v]) => <div key={l} className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3"><p className="text-xs text-zinc-500">{l}</p><p className="mt-2 text-xl font-semibold text-white">{v}</p></div>)}</div></SectionCard>
        <SectionCard eyebrow="Find" title="Invoices & quotes" description="Search current work. Open Archive only when you actually need history."><form className="flex flex-col gap-2 sm:flex-row" action="/invoices" method="get"><input type="hidden" name="status" value={filter}/><label className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500"/><input name="q" defaultValue={params.q ?? ""} placeholder="Customer or invoice number" className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 py-2.5 pl-10 pr-3 text-white"/></label><button className="rounded-xl border border-[#2d7dff]/30 px-4 py-2.5 text-sm text-[#d9fbff]">Search</button></form><div className="mt-3 flex flex-wrap gap-2">{FILTERS.map(([value,label]) => <Link key={value} href={`/invoices?status=${value}`} className={`rounded-full border px-3 py-1.5 text-xs ${filter === value ? "border-[#8ffafa]/60 bg-[#2d7dff]/20 text-white" : "border-[#2d7dff]/20 text-zinc-400"}`}>{label}</Link>)}</div></SectionCard>
        <SectionCard eyebrow={filter === "archive" ? "Customer history" : "Current work"} title={`${filtered.length} document${filtered.length === 1 ? "" : "s"}`} description={filter === "archive" ? "Paid and void records are retained for audit/history without cluttering active billing." : "Only documents that still need action are shown by default."}>{filtered.length ? <div className="space-y-4">{filtered.map((row) => renderCard(row))}</div> : <p className="text-sm text-zinc-400">Nothing in this view.</p>}</SectionCard>
      </>}
    </div>
  </AppShell>;
}
