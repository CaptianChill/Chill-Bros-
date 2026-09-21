import Link from "next/link";
import { BadgeCheck, CalendarClock, FileDown, FileText, ReceiptText } from "lucide-react";
import { notFound } from "next/navigation";

import { PortalShell } from "@/components/portal-shell";
import { ClientPortalActions } from "@/components/client-portal-actions";
import { MediaAccordion } from "@/components/media-accordion";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getInvoiceV2ByToken, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { getJob } from "@/lib/chillbros/queries";
import { getPaymentSettings } from "@/lib/chillbros/payment-settings";
import { PAYMENT_TERMS_LABELS } from "@/lib/chillbros/types";

export const dynamic = "force-dynamic";
type PortalPageProps = { params: Promise<{ token: string }>; searchParams: Promise<{ payment?: string; payment_error?: string }> };
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" }) : "—";

export default async function PortalPage({ params, searchParams }: PortalPageProps) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const invoice = await getInvoiceV2ByToken(token);
  if (!invoice) notFound();
  const [job, paymentSettings] = await Promise.all([invoice.jobId ? getJob(invoice.jobId) : null, getPaymentSettings()]);
  const totals = invoiceTotals(invoice);
  const invoiceIssued = Boolean(invoice.issuedAt);
  const paid = invoice.paymentStatus === "paid";
  const downPaymentRequired = invoice.downPaymentAmount > 0;
  const downPaymentPaid = invoice.downPaymentStatus === "paid";
  const documentLabel = invoiceIssued || paid ? "Invoice" : "Estimate";
  const statusLabel = paid ? "Paid" : invoiceIssued ? "Invoice ready · payment due" : invoice.status === "approved" ? "Estimate approved · work pending" : "Awaiting customer approval";

  return <PortalShell
    title={`${documentLabel} ${invoice.invoiceNumber}`}
    description={invoiceIssued ? "Review the completed work, final invoice, payment options, and receipt status." : "Review the proposed work, pricing, service details, and approve the estimate securely."}
    highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Current status</p><StatusPill tone={paid || invoice.status === "approved" ? "emerald" : "amber"}>{statusLabel}</StatusPill><p className="text-sm text-zinc-300">Customer: {invoice.customerName}</p></div>}
  >
    <div className="space-y-4">
      {query.payment === "processing" && !paid ? <p className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">Payment was submitted. Bank payments can take additional time to confirm; this page updates after the processor confirms payment.</p> : null}
      {query.payment === "cancelled" ? <p className="rounded-2xl border border-zinc-500/25 bg-black/40 px-4 py-3 text-sm text-zinc-300">Online checkout was cancelled. No payment was recorded.</p> : null}
      {query.payment_error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{query.payment_error}</p> : null}

      {invoice.status === "approved" && !invoiceIssued && !paid ? <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4 sm:p-5"><div className="flex items-start gap-3"><BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><h2 className="font-semibold text-white">Your estimate is approved</h2><p className="mt-1 text-sm leading-6 text-zinc-400">{downPaymentRequired && !downPaymentPaid ? "A down payment is due before work begins — pay it below." : downPaymentRequired ? "Down payment received. Chill Pros will complete the approved work or schedule the return visit; the remaining balance is due on the final invoice." : "No final payment is due yet. Chill Pros will complete the approved work or schedule the return visit, then this same secure link becomes your final invoice and payment page."}</p>{job?.scheduledWindow && job.scheduledWindow !== "Approved · needs scheduling" ? <p className="mt-3 inline-flex items-center gap-2 text-sm text-[#bafcfc]"><CalendarClock className="h-4 w-4" />{job.scheduledWindow}</p> : null}</div></div></div> : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard eyebrow="Customer view" title={invoiceIssued ? "Final invoice and work summary" : "Estimate and proposed work"} description={invoiceIssued ? "Completed-work summary with final pricing, terms and proof-of-work media." : "Approved scope stays separate from the final invoice until the work is completed."}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-zinc-400">{documentLabel}</p><p className="text-xl font-semibold text-white">{invoice.invoiceNumber}</p></div><StatusPill tone="emerald">Secure link access</StatusPill></div>{invoiceIssued ? <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2"><p>Terms: <span className="text-white">{PAYMENT_TERMS_LABELS[invoice.paymentTerms]}</span></p><p>Due: <span className="text-white">{date(invoice.dueAt)}</span></p></div> : null}{job?.workPerformed ? <p className="mt-4 text-sm leading-7 text-white">{job.workPerformed}</p> : null}{invoice.notes ? <p className="mt-3 text-sm leading-6 text-zinc-400">{invoice.notes}</p> : null}</div>

            <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
              {invoice.lineItems.length === 0 ? <p className="text-sm text-zinc-400">No line items are available.</p> : invoice.lineItems.map((item) => <div key={item.id} className="border-b border-[#2d7dff]/10 pb-3 last:border-none"><div className="flex items-start justify-between gap-4"><div><p className="text-zinc-200">{item.label}</p>{item.description ? <p className="mt-1 text-xs leading-5 text-zinc-500">{item.description}</p> : null}<p className="mt-1 text-xs text-[#bafcfc]">Qty {item.quantity} × {money(item.unitPrice)}{item.taxable ? " · taxable" : ""}</p></div><p className="shrink-0 font-medium text-white">{money(item.amount)}</p></div></div>)}
              <div className="space-y-2 border-t border-[#2d7dff]/20 pt-3 text-sm"><div className="flex justify-between"><span className="text-zinc-400">Subtotal</span><span>{money(totals.subtotal)}</span></div>{invoice.discountAmount > 0 ? <div className="flex justify-between text-emerald-200"><span>Discount{invoice.discountType === "percent" ? ` (${invoice.discountValue}%)` : ""}</span><span>−{money(invoice.discountAmount)}</span></div> : null}{invoice.taxAmount > 0 ? <div className="flex justify-between"><span className="text-zinc-400">Tax ({invoice.taxRate}%)</span><span>+{money(invoice.taxAmount)}</span></div> : null}{invoice.creditAmount > 0 ? <div className="flex justify-between text-emerald-200"><span>Credit applied</span><span>−{money(invoice.creditAmount)}</span></div> : null}<div className="flex justify-between text-lg font-medium"><span>{invoiceIssued ? "Amount due" : "Approved total"}</span><span className="text-[#bafcfc]">{money(invoiceIssued ? totals.amountDueNow : totals.total)}</span></div>{downPaymentRequired ? <div className={`flex justify-between ${downPaymentPaid ? "text-emerald-200" : "text-amber-100"}`}><span>{downPaymentPaid ? "Down payment paid" : "Down payment due"}</span><span>{money(Math.min(invoice.downPaymentAmount, totals.total))}</span></div> : null}{invoice.refundAmount > 0 ? <div className="flex justify-between text-amber-100"><span>Refunds recorded</span><span>{money(invoice.refundAmount)}</span></div> : null}</div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Link href={`/portal/${invoice.portalToken}/document`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 px-4 py-3 text-sm text-[#d9fbff]"><FileText className="h-4 w-4" />Open fullscreen document</Link>
              {invoice.status === "approved" ? <Link href={`/api/portal/${invoice.portalToken}/pdf?stage=${paid ? "paid" : "approved"}`} target="_blank" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 px-4 py-3 text-sm text-[#d9fbff]"><FileDown className="h-4 w-4" />Open signed PDF</Link> : null}
              {paid ? <Link href={`/portal/${invoice.portalToken}/receipt`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 px-4 py-3 text-sm text-emerald-100 sm:col-span-2"><ReceiptText className="h-4 w-4" />Open payment receipt</Link> : null}
            </div>
            {job ? <MediaAccordion jobId={job.id} beforePhotos={job.beforePhotos} afterPhotos={job.afterPhotos} readOnly /> : null}
          </div>
        </SectionCard>

        <SectionCard eyebrow={invoiceIssued ? "Payment" : downPaymentRequired && !downPaymentPaid ? "Down payment" : "Approval"} title={invoiceIssued ? "Pay securely" : invoice.status === "approved" ? "Approved · next step is the work" : "Review and approve"} description={invoiceIssued ? "Pay through Square using the invoice total shown here." : downPaymentRequired && !downPaymentPaid ? "Approval authorizes the work. A down payment is due now, before work begins." : "Approval authorizes the work. Final payment does not open until Chill Pros completes the job and issues the invoice."}>
          <div className="mb-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-[#2d7dff]/15 bg-black/40 p-3"><p className="text-xs text-zinc-500">{invoiceIssued ? "Invoice total" : "Estimate total"}</p><p className="mt-1 text-xl font-semibold text-[#bafcfc]">{money(invoiceIssued ? totals.amountDueNow : totals.total)}</p></div><div className="rounded-xl border border-[#2d7dff]/15 bg-black/40 p-3"><p className="text-xs text-zinc-500">Status</p><p className="mt-1 text-sm font-semibold text-white">{statusLabel}</p></div></div>
          <ClientPortalActions invoice={invoice} amountDue={invoiceIssued ? totals.amountDueNow : totals.total} paymentSettings={paymentSettings} />
        </SectionCard>
      </div>
    </div>
  </PortalShell>;
}
