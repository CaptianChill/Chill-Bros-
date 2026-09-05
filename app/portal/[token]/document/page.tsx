import { notFound } from "next/navigation";

import { DocumentSignatureForm } from "@/components/document-signature-form";
import { DocumentToolbar } from "@/components/document-toolbar";
import { LogoBadge } from "@/components/logo-badge";
import { getInvoiceV2ByToken, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { getJob } from "@/lib/chillbros/queries";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ token: string }> };
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default async function DocumentPage({ params }: Props) {
  const { token } = await params;
  const invoice = await getInvoiceV2ByToken(token);
  if (!invoice) notFound();
  const job = invoice.jobId ? await getJob(invoice.jobId) : null;
  const totals = invoiceTotals(invoice);
  const documentName = invoice.status === "approved" ? "INVOICE" : "ESTIMATE";

  return <main className="min-h-screen bg-white px-3 py-4 text-zinc-950 sm:px-6 sm:py-8 print:p-0">
    <div className="mx-auto max-w-4xl">
      <DocumentToolbar invoiceNumber={invoice.invoiceNumber} returnHref={`/portal/${token}`} backLabel="Back" />
      <article className="overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-xl print:rounded-none print:border-0 print:shadow-none">
        <header className="border-b border-zinc-200 bg-[#020407] px-6 py-5 text-white sm:px-8"><div className="flex items-center justify-between gap-5"><div className="flex items-center gap-3"><LogoBadge variant="full" className="w-14" /><div><p className="text-2xl font-bold tracking-wide">CHILL BROS</p><p className="text-xs uppercase tracking-[0.24em] text-cyan-100">Service Document</p></div></div><div className="text-right"><p className="text-sm font-semibold tracking-[0.18em] text-cyan-100">{documentName}</p><p className="mt-1 text-lg font-bold">{invoice.invoiceNumber}</p><p className="mt-1 text-xs text-zinc-300">{invoice.paymentStatus === "paid" ? "PAID" : invoice.status === "approved" ? "APPROVED" : "AWAITING APPROVAL"}</p></div></div></header>

        <div className="space-y-6 p-6 sm:p-8">
          <section className="grid gap-4 border-b border-zinc-200 pb-5 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Customer</p><p className="mt-1 text-xl font-semibold">{invoice.customerName}</p>{job?.location ? <p className="mt-1 text-sm text-zinc-600">{job.location}</p> : null}</div><div className="sm:text-right"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Service status</p><p className="mt-1 font-semibold">{job?.status.replace(/_/g, " ") ?? "Document only"}</p>{job?.scheduledWindow ? <p className="mt-1 text-sm text-zinc-600">{job.scheduledWindow}</p> : null}</div></section>

          {invoice.notes || job?.workPerformed ? <section className="rounded-xl bg-zinc-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Service / estimate notes</p>{job?.workPerformed ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{job.workPerformed}</p> : null}{invoice.notes ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{invoice.notes}</p> : null}</section> : null}

          <section><div className="grid grid-cols-[1fr_70px_110px_110px] gap-2 border-b-2 border-zinc-900 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600"><span>Item / description</span><span className="text-right">Qty</span><span className="text-right">Unit</span><span className="text-right">Amount</span></div><div>{invoice.lineItems.map((item) => <div key={item.id} className="grid grid-cols-[1fr_70px_110px_110px] gap-2 border-b border-zinc-200 py-3 text-sm"><div><p className="font-medium">{item.label}</p>{item.description ? <p className="mt-1 text-xs leading-5 text-zinc-500">{item.description}</p> : null}</div><span className="text-right">{item.quantity}</span><span className="text-right">{money(item.unitPrice)}</span><span className="text-right font-medium">{money(item.amount)}</span></div>)}</div></section>

          <section className="ml-auto max-w-sm space-y-2 text-sm"><div className="flex justify-between"><span className="text-zinc-600">Subtotal</span><span>{money(totals.subtotal)}</span></div>{invoice.discountAmount > 0 ? <div className="flex justify-between text-emerald-700"><span>Discount{invoice.discountType === "percent" ? ` (${invoice.discountValue}%)` : ""}</span><span>−{money(invoice.discountAmount)}</span></div> : null}<div className="flex justify-between border-t border-zinc-400 pt-2 text-lg font-bold"><span>Total</span><span>{money(totals.total)}</span></div>{invoice.downPaymentAmount > 0 ? <><div className="flex justify-between font-medium text-amber-700"><span>Down payment required{invoice.downPaymentType === "percent" ? ` (${invoice.downPaymentValue}%)` : ""}</span><span>{money(invoice.downPaymentAmount)}</span></div><div className="flex justify-between"><span className="text-zinc-600">Balance after down payment</span><span>{money(totals.balanceAfterDownPayment)}</span></div></> : null}{invoice.paymentStatus === "paid" ? <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-center font-bold text-emerald-800">PAYMENT RECORDED</div> : null}</section>

          <section className="grid gap-6 border-t border-zinc-200 pt-5 sm:grid-cols-[1.25fr_0.75fr]"><div><DocumentSignatureForm kind="estimate" token={token} initialSignature={invoice.signatureName} initialSignedAt={invoice.signedAt} alreadyApproved={invoice.status === "approved"} /></div><div className="sm:text-right"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Payment method</p><p className="mt-2 text-sm font-semibold">{invoice.paymentMethod ? invoice.paymentMethod.replace(/_/g, " ") : "Not selected"}</p></div></section>
        </div>
      </article>
    </div>
  </main>;
}
