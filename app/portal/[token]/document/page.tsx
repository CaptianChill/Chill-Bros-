import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, FileDown } from "lucide-react";
import { notFound } from "next/navigation";

import { DocumentPaymentMethods } from "@/components/document-payment-methods";
import { DocumentSignatureForm } from "@/components/document-signature-form";
import { DocumentToolbar } from "@/components/document-toolbar";
import { getInvoiceV2ByToken, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { getJob } from "@/lib/chillbros/queries";
import { getPaymentSettings } from "@/lib/chillbros/payment-settings";
import { PAYMENT_TERMS_LABELS } from "@/lib/chillbros/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Chill Pros Service Document" };
type Props = { params: Promise<{ token: string }> };

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" }) : "—";
const LEGACY_SERVICE_NOTE = "you never restricting the capillary tube recover refrigerant ran a deep vacuum charge system with 1 pound 134 a monitored operation unit is hitting temp";

function polishedServiceCopy(value: string | null | undefined) {
  const clean = String(value ?? "").trim();
  const normalized = clean.toLowerCase().replace(/\s+/g, " ");
  if (normalized === LEGACY_SERVICE_NOTE) return "Repaired a restriction in the capillary tube. Recovered the refrigerant, pulled a deep vacuum, and recharged the system with 1 lb of R-134a. Monitored system operation and confirmed the unit is reaching the target temperature.";
  return clean;
}

export default async function DocumentPage({ params }: Props) {
  const { token } = await params;
  const invoice = await getInvoiceV2ByToken(token);
  if (!invoice) notFound();

  const [job, paymentSettings] = await Promise.all([invoice.jobId ? getJob(invoice.jobId) : null, getPaymentSettings()]);
  const totals = invoiceTotals(invoice);
  const invoiceIssued = Boolean(invoice.issuedAt);
  const paid = invoice.paymentStatus === "paid";
  const documentName = invoiceIssued || paid ? "INVOICE" : "ESTIMATE";
  const workPerformed = polishedServiceCopy(job?.workPerformed);
  const estimateNotes = polishedServiceCopy(invoice.notes);
  const status = paid ? "PAID" : invoiceIssued ? "INVOICE ISSUED" : invoice.status === "approved" ? "APPROVED ESTIMATE" : "AWAITING APPROVAL";

  return <main className="min-h-screen overflow-x-hidden bg-white px-3 py-4 text-zinc-950 sm:px-6 sm:py-8 print:p-0">
    <div className="mx-auto w-full max-w-4xl">
      <DocumentToolbar invoiceNumber={invoice.invoiceNumber} returnHref={`/portal/${token}`} backLabel="Back" />

      <article className="w-full max-w-full overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-xl print:rounded-none print:border-0 print:shadow-none">
        <header className="border-b border-zinc-200 bg-[#020407] px-4 py-5 text-white sm:px-8">
          <div className="flex min-w-0 flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex min-w-0 flex-col items-center gap-3 sm:flex-row"><Image src="/chill-pros-document-logo.png" alt="Chill Pros logo" width={220} height={220} priority className="h-auto w-20 shrink-0 object-contain sm:w-16" /><div className="min-w-0"><p className="text-2xl font-bold tracking-wide">CHILL PROS</p><p className="text-xs uppercase tracking-[0.2em] text-cyan-100 sm:tracking-[0.24em]">Service Document</p></div></div>
            <div className="min-w-0 max-w-full text-center sm:max-w-[56%] sm:text-right"><p className="text-sm font-semibold tracking-[0.18em] text-cyan-100">{documentName}</p><p className="mt-1 break-all text-base font-bold sm:text-lg">{invoice.invoiceNumber}</p><p className="mt-1 text-xs text-zinc-300">{status}</p></div>
          </div>
        </header>

        <div className="space-y-6 p-4 sm:p-8">
          <section className="grid gap-4 border-b border-zinc-200 pb-5 text-center sm:grid-cols-2 sm:text-left">
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Customer</p><p className="mt-1 break-words text-xl font-semibold [overflow-wrap:anywhere]">{invoice.customerName}</p>{job?.location ? <p className="mt-1 break-words text-sm text-zinc-600 [overflow-wrap:anywhere]">{job.location}</p> : null}</div>
            <div className="min-w-0 sm:text-right"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{invoiceIssued ? "Billing terms" : "Job status"}</p>{invoiceIssued ? <><p className="mt-1 font-semibold">{PAYMENT_TERMS_LABELS[invoice.paymentTerms]}</p>{invoice.dueAt ? <p className="mt-1 text-sm text-zinc-600">Due {date(invoice.dueAt)}</p> : null}</> : <p className="mt-1 font-semibold">{invoice.status === "approved" ? "Approved work pending completion" : "Customer approval required"}</p>}{job?.scheduledWindow ? <p className="mt-1 break-words text-xs text-zinc-500 [overflow-wrap:anywhere]">Service: {job.scheduledWindow}</p> : null}</div>
          </section>

          {invoice.status === "approved" && !invoiceIssued && !paid ? <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start gap-3"><BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div><p className="font-semibold text-emerald-900">Estimate approved</p><p className="mt-1 text-sm leading-6 text-emerald-900/80">This signed document authorizes the quoted work. The final invoice and payment options will appear after Chill Pros completes the approved work.</p></div></div></section> : null}

          {estimateNotes || workPerformed ? <section className="rounded-xl bg-zinc-50 p-4"><p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:text-left">Service / estimate notes</p>{workPerformed ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{workPerformed}</p> : null}{estimateNotes ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700 [overflow-wrap:anywhere]">{estimateNotes}</p> : null}</section> : null}

          <section>
            <div className="hidden grid-cols-[minmax(0,1fr)_70px_110px_110px] gap-2 border-b-2 border-zinc-900 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600 sm:grid"><span>Item / description</span><span className="text-right">Qty</span><span className="text-right">Unit</span><span className="text-right">Amount</span></div>
            <div>{invoice.lineItems.map((item) => <div key={item.id} className="grid min-w-0 gap-3 border-b border-zinc-200 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_70px_110px_110px] sm:gap-2 sm:py-3"><div className="min-w-0 sm:pr-2"><p className="flex flex-wrap items-baseline gap-x-2 break-words font-medium [overflow-wrap:anywhere]"><span>{item.label}</span>{item.taxable ? <span className="text-[10px] uppercase tracking-wide text-zinc-500">taxable</span> : null}</p>{item.description ? <p className="mt-1 break-words text-xs leading-5 text-zinc-500 [overflow-wrap:anywhere]">{item.description}</p> : null}</div><div className="grid grid-cols-3 gap-2 rounded-lg bg-zinc-50 p-2 sm:contents"><span className="text-center sm:text-right"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:hidden">Qty</span>{item.quantity}</span><span className="break-words text-center [overflow-wrap:anywhere] sm:text-right"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:hidden">Unit</span>{money(item.unitPrice)}</span><span className="break-words text-center font-medium [overflow-wrap:anywhere] sm:text-right"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:hidden">Amount</span>{money(item.amount)}</span></div></div>)}</div>
          </section>

          <section className="ml-auto w-full max-w-sm space-y-2 text-sm"><div className="flex justify-between gap-4"><span className="text-zinc-600">Subtotal</span><span>{money(totals.subtotal)}</span></div>{invoice.discountAmount > 0 ? <div className="flex justify-between gap-4 text-emerald-700"><span>Discount{invoice.discountType === "percent" ? ` (${invoice.discountValue}%)` : ""}</span><span>−{money(invoice.discountAmount)}</span></div> : null}{invoice.taxAmount > 0 ? <div className="flex justify-between gap-4"><span className="text-zinc-600">Tax ({invoice.taxRate}%)</span><span>+{money(invoice.taxAmount)}</span></div> : null}{invoice.creditAmount > 0 ? <div className="flex justify-between gap-4 text-emerald-700"><span>Credit applied</span><span>−{money(invoice.creditAmount)}</span></div> : null}<div className="flex justify-between gap-4 border-t border-zinc-400 pt-2 text-lg font-bold"><span>{invoiceIssued ? "Amount due" : "Approved total"}</span><span>{money(totals.total)}</span></div>{invoice.downPaymentAmount > 0 ? <div className="flex justify-between gap-4 font-medium text-amber-700"><span>Quoted down payment{invoice.downPaymentType === "percent" ? ` (${invoice.downPaymentValue}%)` : ""}</span><span>{money(Math.min(invoice.downPaymentAmount, totals.total))}</span></div> : null}{invoice.refundAmount > 0 ? <div className="flex justify-between gap-4 text-amber-700"><span>Refunds recorded</span><span>{money(invoice.refundAmount)}</span></div> : null}{paid ? <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-center font-bold text-emerald-800">PAYMENT RECORDED</div> : null}</section>

          <section className="grid gap-6 border-t border-zinc-200 pt-5 sm:grid-cols-[1.25fr_0.75fr]">
            <div><DocumentSignatureForm kind="estimate" token={token} initialSignature={invoice.signatureName} initialSignedAt={invoice.signedAt} alreadyApproved={invoice.status === "approved"} /></div>
            <div className="text-center sm:text-right"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{invoiceIssued ? "Payment method" : "Document stage"}</p><p className="mt-2 break-words text-sm font-semibold [overflow-wrap:anywhere]">{invoiceIssued ? paid ? invoice.paymentMethod ? invoice.paymentMethod.replace(/_/g, " ") : "Recorded by office" : invoice.paymentMethod === "cash" ? "Cash (awaiting confirmation)" : invoice.paymentMethod === "check" ? "Check (awaiting confirmation)" : "Square" : invoice.status === "approved" ? "Signed estimate" : "Estimate awaiting signature"}</p>{invoice.status === "approved" ? <Link href={`/api/portal/${token}/pdf?stage=${paid ? "paid" : "approved"}`} target="_blank" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-xs"><FileDown className="h-3.5 w-3.5" />Archived PDF</Link> : null}</div>
          </section>

          {invoiceIssued && invoice.status === "approved" ? <DocumentPaymentMethods token={token} initialMethod={invoice.paymentMethod} paymentStatus={invoice.paymentStatus} amountDue={totals.total} invoiceNumber={invoice.invoiceNumber} settings={paymentSettings} /> : invoice.status === "approved" ? <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"><strong>Next step:</strong> Chill Pros completes the approved work. This same document becomes the final invoice when the job is finished. No final payment is due yet.</section> : <section className="rounded-xl border border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700"><strong>Next step:</strong> Sign and approve the estimate above.</section>}
        </div>
      </article>
    </div>
  </main>;
}
