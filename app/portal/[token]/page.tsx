import Link from "next/link";
import { FileText } from "lucide-react";
import { notFound } from "next/navigation";

import { PortalShell } from "@/components/portal-shell";
import { ClientPortalActions } from "@/components/client-portal-actions";
import { MediaAccordion } from "@/components/media-accordion";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getInvoiceV2ByToken, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { getJob } from "@/lib/chillbros/queries";

export const dynamic = "force-dynamic";
type PortalPageProps = { params: Promise<{ token: string }> };
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default async function PortalPage({ params }: PortalPageProps) {
  const { token } = await params;
  const invoice = await getInvoiceV2ByToken(token);
  if (!invoice) notFound();
  const job = invoice.jobId ? await getJob(invoice.jobId) : null;
  const totals = invoiceTotals(invoice);
  const statusLabel = invoice.paymentStatus === "paid" ? "Paid" : invoice.status === "approved" ? "Approved" : "Awaiting customer approval";

  return <PortalShell
    title={`${invoice.status === "approved" ? "Invoice" : "Estimate"} ${invoice.invoiceNumber}`}
    description="Review itemized pricing, discount and down-payment terms, service details, proof-of-work, digital approval, and payment preference."
    highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Document status</p><StatusPill tone={invoice.status === "approved" || invoice.paymentStatus === "paid" ? "emerald" : "amber"}>{statusLabel}</StatusPill><p className="text-sm text-zinc-300">Customer: {invoice.customerName}</p></div>}
  >
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <SectionCard eyebrow="Customer view" title="Itemized estimate and work summary" description="Line-item pricing with quantity, description, discounts, deposit terms, and proof-of-work media.">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-zinc-400">{invoice.status === "approved" ? "Invoice" : "Estimate"}</p><p className="text-xl font-semibold text-white">{invoice.invoiceNumber}</p></div><StatusPill tone="emerald">Secure link access</StatusPill></div>{job?.workPerformed ? <p className="mt-4 text-sm leading-7 text-white">{job.workPerformed}</p> : null}{invoice.notes ? <p className="mt-3 text-sm leading-6 text-zinc-400">{invoice.notes}</p> : null}</div>

          <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
            {invoice.lineItems.length === 0 ? <p className="text-sm text-zinc-400">No line items are available.</p> : invoice.lineItems.map((item) => <div key={item.id} className="border-b border-[#2d7dff]/10 pb-3 last:border-none"><div className="flex items-start justify-between gap-4"><div><p className="text-zinc-200">{item.label}</p>{item.description ? <p className="mt-1 text-xs leading-5 text-zinc-500">{item.description}</p> : null}<p className="mt-1 text-xs text-[#bafcfc]">Qty {item.quantity} × {money(item.unitPrice)}</p></div><p className="shrink-0 font-medium text-white">{money(item.amount)}</p></div></div>)}
            <div className="space-y-2 border-t border-[#2d7dff]/20 pt-3 text-sm"><div className="flex justify-between"><span className="text-zinc-400">Subtotal</span><span>{money(totals.subtotal)}</span></div>{invoice.discountAmount > 0 ? <div className="flex justify-between text-emerald-200"><span>Discount{invoice.discountType === "percent" ? ` (${invoice.discountValue}%)` : ""}</span><span>−{money(invoice.discountAmount)}</span></div> : null}<div className="flex justify-between text-lg font-medium"><span>Total</span><span className="text-[#bafcfc]">{money(totals.total)}</span></div>{invoice.downPaymentAmount > 0 ? <><div className="flex justify-between text-amber-100"><span>Down payment required{invoice.downPaymentType === "percent" ? ` (${invoice.downPaymentValue}%)` : ""}</span><span>{money(invoice.downPaymentAmount)}</span></div><div className="flex justify-between"><span className="text-zinc-400">Remaining after down payment</span><span>{money(totals.balanceAfterDownPayment)}</span></div></> : null}</div>
          </div>
          <Link href={`/portal/${invoice.portalToken}/document`} target="_blank" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 px-4 py-3 text-sm text-[#d9fbff]"><FileText className="h-4 w-4" />Open fullscreen document view</Link>
          {job ? <MediaAccordion jobId={job.id} beforePhotos={job.beforePhotos} afterPhotos={job.afterPhotos} readOnly /> : null}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Approval & payment preference" title="Review, sign, and choose a payment method" description="The discount and required down payment shown here are included in the approved document.">
        <div className="mb-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-[#2d7dff]/15 bg-black/40 p-3"><p className="text-xs text-zinc-500">Total after discount</p><p className="mt-1 text-xl font-semibold text-[#bafcfc]">{money(totals.total)}</p></div><div className="rounded-xl border border-[#2d7dff]/15 bg-black/40 p-3"><p className="text-xs text-zinc-500">Down payment required</p><p className="mt-1 text-xl font-semibold text-amber-100">{money(invoice.downPaymentAmount)}</p></div></div>
        <ClientPortalActions invoice={invoice} />
      </SectionCard>
    </div>
  </PortalShell>;
}
