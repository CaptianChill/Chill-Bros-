import { AppShell } from "@/components/app-shell";
import { ClientPortalActions } from "@/components/client-portal-actions";
import { MediaAccordion } from "@/components/media-accordion";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { quoteBreakdown, serviceJob } from "@/lib/mock-data";

export default function TechnicianPage() {
  const total = quoteBreakdown.reduce((sum, item) => sum + item.amount, 0);

  return (
    <AppShell
      title="Technician service workflow with compact media uploads and on-site quote approval."
      description="The layout below mirrors the two-part field workflow from the brief: service notes and media capture up top, then customer-facing quote approval and digital link actions below for clean mobile use."
      highlight={
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Assigned job</p>
          <p className="text-2xl font-semibold text-white">{serviceJob.id}</p>
          <p className="text-sm text-zinc-300">{serviceJob.customer}</p>
          <StatusPill tone="emerald">Scheduled {serviceJob.scheduledWindow}</StatusPill>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard eyebrow="Top half" title="Service log & media uploads" description="Read-only dispatch metadata, work performed notes, parts used, and a collapsible before/after upload section.">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[#00f0f0]/20 bg-black/40 p-4">
                <p className="text-sm text-zinc-400">Customer</p>
                <p className="mt-2 text-lg font-medium text-white">{serviceJob.customer}</p>
                <p className="mt-2 text-sm text-zinc-300">{serviceJob.location}</p>
              </div>
              <div className="rounded-2xl border border-[#00f0f0]/20 bg-black/40 p-4">
                <p className="text-sm text-zinc-400">Assigned technician</p>
                <p className="mt-2 text-lg font-medium text-white">{serviceJob.assignedTech}</p>
                <p className="mt-2 text-sm text-zinc-300">{serviceJob.scheduledWindow}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#00f0f0]/20 bg-black/40 p-4">
              <p className="text-sm text-zinc-400">Dispatch scope</p>
              <p className="mt-2 text-sm leading-7 text-white">{serviceJob.scope}</p>
            </div>

            <div className="rounded-2xl border border-[#00f0f0]/20 bg-black/40 p-4">
              <p className="text-sm text-zinc-400">Work performed</p>
              <p className="mt-2 text-sm leading-7 text-white">{serviceJob.workPerformed}</p>
            </div>

            <div className="rounded-2xl border border-[#00f0f0]/20 bg-black/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-white">Parts used</p>
                <StatusPill>Quick lookup pricing</StatusPill>
              </div>
              <div className="mt-4 space-y-3">
                {serviceJob.partsUsed.map((part) => (
                  <div key={part.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#00f0f0]/10 bg-zinc-950/80 px-4 py-3">
                    <div>
                      <p className="text-white">{part.name}</p>
                      <p className="text-sm text-zinc-400">{part.partNumber}</p>
                    </div>
                    <p className="text-[#bafcfc]">${part.retailPrice}</p>
                  </div>
                ))}
              </div>
            </div>

            <MediaAccordion beforePhotos={serviceJob.beforePhotos} afterPhotos={serviceJob.afterPhotos} />
          </div>
        </SectionCard>

        <SectionCard eyebrow="Bottom half" title="Customer quote & approval" description="Calculated quote rows, customer signature controls, and digital link workflow entry points for remote approval.">
          <div className="space-y-5">
            <div className="space-y-3 rounded-2xl border border-[#00f0f0]/20 bg-black/40 p-4">
              {quoteBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 border-b border-[#00f0f0]/10 pb-3 last:border-none last:pb-0">
                  <p className="text-zinc-300">{item.label}</p>
                  <p className="font-medium text-white">${item.amount}</p>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-[#00f0f0]/20 pt-3">
                <p className="text-lg font-medium text-white">Quote total</p>
                <p className="text-2xl font-semibold text-[#bafcfc]">${total}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#00f0f0]/20 bg-black/40 p-4">
              <p className="text-sm text-zinc-400">Scope of work for customer</p>
              <p className="mt-2 text-sm leading-7 text-white">Replace failed capacitor and contactor, verify startup amperage, confirm cooling performance, and attach before/after proof of work to the final customer portal link.</p>
            </div>

            <ClientPortalActions />
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
