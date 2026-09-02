import { AppShell } from "@/components/app-shell";
import { ClientPortalActions } from "@/components/client-portal-actions";
import { MediaAccordion } from "@/components/media-accordion";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { portalInvoice, quoteBreakdown, serviceJob } from "@/lib/mock-data";

type PortalPageProps = {
  params: Promise<{ invoiceId: string }>;
};

export default async function PortalPage({ params }: PortalPageProps) {
  const { invoiceId } = await params;
  const total = quoteBreakdown.reduce((sum, item) => sum + item.amount, 0);

  return (
    <AppShell
      title={`Client portal for ${invoiceId}`}
      description="A clean customer-facing route for reviewing itemized work, proof-of-work photos, digital approvals, and payment options inside the same Chill Bros visual system."
      highlight={
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Portal status</p>
          <StatusPill tone="amber">{portalInvoice.status}</StatusPill>
          <p className="text-sm text-zinc-300">Customer: {portalInvoice.customerName}</p>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard eyebrow="Customer view" title="Itemized quote and work summary" description="Transparent line-item pricing, service explanation, and proof-of-work media for online review.">
          <div className="space-y-5">
            <div className="rounded-2xl border border-cyan-400/20 bg-black/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-400">Invoice</p>
                  <p className="text-xl font-semibold text-white">{invoiceId}</p>
                </div>
                <StatusPill tone="emerald">Secure link access</StatusPill>
              </div>
              <p className="mt-4 text-sm leading-7 text-white">{portalInvoice.workSummary}</p>
              <p className="mt-3 text-sm text-zinc-400">{portalInvoice.notes}</p>
            </div>

            <div className="space-y-3 rounded-2xl border border-cyan-400/20 bg-black/40 p-4">
              {quoteBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 border-b border-cyan-400/10 pb-3 last:border-none last:pb-0">
                  <p className="text-zinc-300">{item.label}</p>
                  <p className="font-medium text-white">${item.amount}</p>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-cyan-400/20 pt-3">
                <p className="text-lg font-medium text-white">Total due</p>
                <p className="text-2xl font-semibold text-cyan-200">${total}</p>
              </div>
            </div>

            <MediaAccordion beforePhotos={serviceJob.beforePhotos} afterPhotos={serviceJob.afterPhotos} />
          </div>
        </SectionCard>

        <SectionCard eyebrow="Approval & payment" title="Review, sign, and pay online" description="Customers can sign directly, pick a payment path, or receive a branded digital link for later completion.">
          <ClientPortalActions />
        </SectionCard>
      </div>
    </AppShell>
  );
}
