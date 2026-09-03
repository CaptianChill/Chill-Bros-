import { notFound } from "next/navigation";

import { PortalShell } from "@/components/portal-shell";
import { ClientPortalActions } from "@/components/client-portal-actions";
import { MediaAccordion } from "@/components/media-accordion";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getInvoiceByToken, getJob } from "@/lib/chillbros/queries";

export const dynamic = "force-dynamic";

type PortalPageProps = {
  params: Promise<{ token: string }>;
};

export default async function PortalPage({ params }: PortalPageProps) {
  const { token } = await params;
  const invoice = await getInvoiceByToken(token);
  if (!invoice) notFound();

  const job = invoice.jobId ? await getJob(invoice.jobId) : null;
  const total = invoice.lineItems.reduce((sum, item) => sum + item.amount, 0);
  const statusLabel = invoice.status === "approved" ? "Approved" : "Awaiting customer approval";

  return (
    <PortalShell
      title={`Estimate ${invoice.invoiceNumber}`}
      description="Review the itemized estimate, service details, proof-of-work photos, digital approval, and preferred payment method inside the Chill Bros customer portal."
      highlight={
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Estimate status</p>
          <StatusPill tone={invoice.status === "approved" ? "emerald" : "amber"}>{statusLabel}</StatusPill>
          <p className="text-sm text-zinc-300">Customer: {invoice.customerName}</p>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard eyebrow="Customer view" title="Itemized estimate and work summary" description="Transparent line-item pricing, service explanation, and proof-of-work media for online review.">
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-400">Estimate</p>
                  <p className="text-xl font-semibold text-white">{invoice.invoiceNumber}</p>
                </div>
                <StatusPill tone="emerald">Secure link access</StatusPill>
              </div>
              {job?.workPerformed ? <p className="mt-4 text-sm leading-7 text-white">{job.workPerformed}</p> : null}
              {invoice.notes ? <p className="mt-3 text-sm text-zinc-400">{invoice.notes}</p> : null}
            </div>

            <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
              {invoice.lineItems.length === 0 ? (
                <p className="text-sm text-zinc-400">No line items are available on this estimate.</p>
              ) : (
                invoice.lineItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 border-b border-[#2d7dff]/10 pb-3 last:border-none last:pb-0">
                    <p className="text-zinc-300">{item.label}</p>
                    <p className="font-medium text-white">${item.amount.toFixed(2)}</p>
                  </div>
                ))
              )}
              <div className="flex items-center justify-between border-t border-[#2d7dff]/20 pt-3">
                <p className="text-lg font-medium text-white">Estimate total</p>
                <p className="text-2xl font-semibold text-[#bafcfc]">${total.toFixed(2)}</p>
              </div>
            </div>

            {job ? <MediaAccordion jobId={job.id} beforePhotos={job.beforePhotos} afterPhotos={job.afterPhotos} readOnly /> : null}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Approval & payment preference" title="Review, sign, and choose a payment method" description="Customers can approve the estimate and record how they want to pay. Payment collection remains an office-confirmed workflow in this release.">
          <ClientPortalActions invoice={invoice} />
        </SectionCard>
      </div>
    </PortalShell>
  );
}
