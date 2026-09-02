import { Search, Wrench } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { feeSettings, partsCatalog } from "@/lib/mock-data";

export default function InventoryPage() {
  return (
    <AppShell
      title="Parts catalog, stock visibility, and automatic fee presets for quotes and invoices."
      description="The inventory workspace keeps standard parts searchable for technicians while giving managers a clean admin surface for pricing, cost, and stock control."
      highlight={
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Catalog state</p>
          <p className="text-3xl font-semibold text-white">{partsCatalog.length} standard parts</p>
          <StatusPill>Quick-search ready</StatusPill>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard eyebrow="Parts database" title="Searchable service inventory" description="Create, review, and price standard parts so technician quotes and customer invoices stay consistent.">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#00f0f0]/30 px-4 py-2 text-sm text-[#defefe]">
            <Search className="h-4 w-4" />
            Quick search lookups available while filling service tickets
          </div>
          <div className="overflow-hidden rounded-3xl border border-[#00f0f0]/20 bg-black/40">
            <table className="min-w-full text-left text-sm text-zinc-300">
              <thead className="bg-[#00f0f0]/10 text-[#defefe]">
                <tr>
                  <th className="px-4 py-3 font-medium">Part</th>
                  <th className="px-4 py-3 font-medium">Part #</th>
                  <th className="px-4 py-3 font-medium">Cost</th>
                  <th className="px-4 py-3 font-medium">Retail</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {partsCatalog.map((part) => (
                  <tr key={part.id} className="border-t border-[#00f0f0]/10">
                    <td className="px-4 py-3">{part.name}</td>
                    <td className="px-4 py-3 text-zinc-400">{part.partNumber}</td>
                    <td className="px-4 py-3">${part.defaultCost}</td>
                    <td className="px-4 py-3 text-[#bafcfc]">${part.retailPrice}</td>
                    <td className="px-4 py-3">{part.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Auto fees" title="Baseline service charges" description="Managers can keep dispatch and arrival pricing aligned so new jobs open with the correct defaults.">
          <div className="space-y-3">
            {feeSettings.map((fee) => (
              <div key={fee.label} className="rounded-2xl border border-[#00f0f0]/20 bg-black/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{fee.label}</p>
                    <p className="mt-1 text-sm text-zinc-400">Editable manager-level pricing control</p>
                  </div>
                  <p className="text-xl font-semibold text-[#bafcfc]">${fee.amount}</p>
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-dashed border-[#00f0f0]/30 bg-black/20 p-4 text-sm text-zinc-300">
              <div className="flex items-center gap-2 text-[#bafcfc]">
                <Wrench className="h-4 w-4" />
                Future Firebase persistence can store live catalog and pricing updates here.
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
