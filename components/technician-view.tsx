import Link from "next/link";
import { Camera, ChevronRight, ClipboardList, ExternalLink, FileText, MapPin, Navigation, Phone, Receipt, Search, Sparkles, StickyNote, Wrench } from "lucide-react";

import { ClientPortalActions } from "@/components/client-portal-actions";
import { EstimateAdjustmentsEditor } from "@/components/estimate-adjustments-editor";
import { EstimateComposer } from "@/components/estimate-composer";
import { FoldSection } from "@/components/fold-section";
import { MediaAccordion } from "@/components/media-accordion";
import { OwnerEstimateEditor } from "@/components/owner-estimate-editor";
import { StatusPill } from "@/components/status-pill";
import { TechnicianJobEditor } from "@/components/technician-job-editor";
import type { EquipmentRecord } from "@/lib/chillbros/equipment-queries";
import type { DetailedInvoice } from "@/lib/chillbros/types";
import type { DispatchJob } from "@/lib/chillbros/operations-queries";
import type { PaymentSettings } from "@/lib/chillbros/payment-settings";
import { JOB_STATUS_LABELS, type Job, type PartsCatalogItem } from "@/lib/chillbros/types";

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const tool = "flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-lg border border-[#2d7dff]/30 bg-black/40 px-1 py-1.5 text-center text-[11px] font-medium leading-tight text-[#d9fbff] transition hover:border-[#2d7dff]/60";
const label = "text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500";

type Totals = { subtotal: number; total: number; balanceAfterDownPayment: number };
type SuggestedItem = { label: string; description?: string; quantity?: number; unitPrice?: number };

export type TechnicianViewProps = {
  isManager: boolean;
  profileId: string;
  fieldJobs: DispatchJob[];
  selectedId: string | null;
  job: Job | null;
  invoice: DetailedInvoice | null;
  totals: Totals | null;
  partsCatalog: PartsCatalogItem[];
  equipment: EquipmentRecord[];
  paymentSettings: PaymentSettings;
  suggestedItems: SuggestedItem[];
  callHref: string | null;
  directionsHref: string | null;
};

export function TechnicianView(p: TechnicianViewProps) {
  const { isManager, fieldJobs, selectedId, job, invoice, totals, equipment } = p;
  const photoCount = job ? job.beforePhotos.length + job.afterPhotos.length : 0;

  return <div className="space-y-3">
    {fieldJobs.length > 1 ? <nav aria-label={isManager ? "Active field jobs" : "My calls"} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {fieldJobs.map((item) => {
        const on = item.id === selectedId;
        return <Link key={item.id} href={`/technician?job=${item.id}`} aria-current={on ? "true" : undefined} className={`min-w-[180px] max-w-[220px] shrink-0 rounded-lg border px-3 py-2 text-left transition ${on ? "border-[#2d7dff] bg-[#2d7dff]/15" : "border-[#2d7dff]/20 bg-black/40 hover:border-[#2d7dff]/45"}`}>
          <p className="truncate text-sm font-semibold text-white">{item.customerName}</p>
          <p className="mt-0.5 truncate text-[11px] text-[#bafcfc]">{JOB_STATUS_LABELS[item.status]}{item.scheduledWindow ? ` · ${item.scheduledWindow}` : ""}</p>
          {isManager ? <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.1em] text-zinc-500">{item.assignedTechName ?? "Unassigned"}</p> : null}
        </Link>;
      })}
    </nav> : null}

    {!job ? <div className="panel neon-frame rounded-xl px-4 py-5 text-left">
      <p className="text-base font-semibold text-white">No active call right now</p>
      <p className="mt-1 text-sm text-zinc-400">{isManager ? "Create or assign a call from Dispatch." : "New assigned calls show up here automatically."}</p>
      {isManager ? <Link href="/dispatch" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#8ffafa]">Open Dispatch<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link> : null}
    </div> : <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:items-start">
      <section aria-label="Current call" className="panel neon-frame min-w-0 space-y-3 rounded-xl p-3.5 text-left">
        <header className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={label}>{isManager ? "Field override" : "Current call"}</p>
              <h2 className="mt-0.5 break-words text-[22px] font-bold leading-tight text-white">{job.customerName}</h2>
            </div>
            <StatusPill tone="emerald">{JOB_STATUS_LABELS[job.status]}</StatusPill>
          </div>
          <p className="flex items-start gap-1.5 text-sm text-zinc-300"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8ffafa]" aria-hidden="true" /><span className="min-w-0">{job.location ?? "No location tagged"}</span></p>
          {job.scheduledWindow || isManager ? <p className="text-xs text-[#bafcfc]">{[job.scheduledWindow, isManager ? (job.assignedTechName ? `Tech: ${job.assignedTechName}` : "Unassigned") : null].filter(Boolean).join(" · ")}</p> : null}
        </header>

        <nav aria-label="Call tools" className="grid grid-cols-5 gap-1.5">
          {p.callHref ? <a href={p.callHref} className={tool}><Phone className="h-4 w-4" aria-hidden="true" />Call</a> : <span className={`${tool} opacity-40`} aria-disabled="true"><Phone className="h-4 w-4" aria-hidden="true" />No phone</span>}
          {p.directionsHref ? <a href={p.directionsHref} target="_blank" rel="noopener noreferrer" className={tool}><Navigation className="h-4 w-4" aria-hidden="true" />Directions</a> : <span className={`${tool} opacity-40`} aria-disabled="true"><Navigation className="h-4 w-4" aria-hidden="true" />No address</span>}
          <Link href={`/tech-assist/${job.id}`} className={`${tool} border-[#8ffafa]/40 bg-[#2d7dff]/10`}><Sparkles className="h-4 w-4" aria-hidden="true" />Tech Assist</Link>
          <Link href={`/field-notes?job=${job.id}`} className={tool}><StickyNote className="h-4 w-4" aria-hidden="true" />Note</Link>
          <Link href="/parts-lookup" className={tool}><Search className="h-4 w-4" aria-hidden="true" />Parts</Link>
        </nav>

        <details className="group rounded-lg border border-[#2d7dff]/20 bg-black/40 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
            <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-[#8ffafa]" aria-hidden="true" />
            <span className="min-w-0 flex-1"><span className={label}>Complaint / scope</span><span className="mt-0.5 line-clamp-2 text-sm leading-5 text-white group-open:hidden">{job.scope ?? "No scope notes yet."}</span></span>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#bafcfc] transition-transform group-open:rotate-90" aria-hidden="true" />
          </summary>
          <p className="mt-1 whitespace-pre-line pl-6 text-sm leading-6 text-white">{job.scope ?? "No scope notes yet."}</p>
        </details>

        <TechnicianJobEditor job={job} partsCatalog={p.partsCatalog} />
      </section>

      <div className="min-w-0 space-y-3">
        <FoldSection
          title={isManager ? "Pricing & approval" : "Estimate & approval"}
          icon={<Receipt className="h-4 w-4" />}
          meta={invoice ? `${invoice.invoiceNumber} · ${money(totals?.total ?? 0)}` : "No estimate yet · tap to build one"}
          badge={invoice ? <StatusPill tone={invoice.status === "approved" ? "emerald" : "amber"}>{invoice.status === "approved" ? "Approved" : "Awaiting"}</StatusPill> : null}
        >
          {invoice ? <div className="space-y-3">
            <ul className="divide-y divide-[#2d7dff]/10 rounded-lg border border-[#2d7dff]/20 bg-black/40 px-3">
              {invoice.lineItems.map((item) => <li key={item.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0"><p className="text-sm font-medium text-zinc-100">{item.label}</p><p className="text-[11px] text-[#bafcfc]">Qty {item.quantity} × {money(item.unitPrice)}{item.taxable ? " · taxable" : ""}</p>{item.description ? <p className="text-[11px] leading-4 text-zinc-500">{item.description}</p> : null}</div>
                <p className="shrink-0 text-sm font-semibold text-white">{money(item.amount)}</p>
              </li>)}
            </ul>
            {totals ? <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-zinc-400">Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
              {invoice.discountAmount > 0 ? <div className="flex justify-between text-emerald-200"><dt>Discount</dt><dd>−{money(invoice.discountAmount)}</dd></div> : null}
              {invoice.taxAmount > 0 ? <div className="flex justify-between"><dt className="text-zinc-400">Tax</dt><dd>{money(invoice.taxAmount)}</dd></div> : null}
              <div className="flex justify-between border-t border-[#2d7dff]/20 pt-1 text-base font-semibold text-white"><dt>Total</dt><dd className="text-[#bafcfc]">{money(totals.total)}</dd></div>
              {invoice.downPaymentAmount > 0 ? <><div className="flex justify-between text-amber-100"><dt>Down payment</dt><dd>{money(invoice.downPaymentAmount)}</dd></div><div className="flex justify-between text-xs"><dt className="text-zinc-400">Balance after down payment</dt><dd>{money(totals.balanceAfterDownPayment)}</dd></div></> : null}
            </dl> : null}
            {isManager && invoice.status !== "approved" ? <OwnerEstimateEditor invoice={invoice} /> : null}
            <EstimateAdjustmentsEditor invoice={invoice} />
            {isManager && invoice.status === "approved" ? <p className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs leading-5 text-amber-100">Approved pricing is locked. Use <Link href="/invoices" className="font-semibold underline">Invoice Center</Link> for audited corrections.</p> : null}
            <ClientPortalActions invoice={invoice} paymentSettings={p.paymentSettings} />
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/portal/${invoice.portalToken}`} target="_blank" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#2d7dff]/30 px-2 py-2 text-xs font-medium text-[#d9fbff]"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />Customer view</Link>
              <Link href={`/portal/${invoice.portalToken}/document`} target="_blank" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#2d7dff]/30 px-2 py-2 text-xs font-medium text-[#d9fbff]"><FileText className="h-3.5 w-3.5" aria-hidden="true" />Full document</Link>
            </div>
          </div> : <EstimateComposer key={job.id} jobId={job.id} profileId={p.profileId} suggestedItems={p.suggestedItems} />}
        </FoldSection>

        <FoldSection title="Equipment on site" icon={<Wrench className="h-4 w-4" />} meta={equipment.length ? `${equipment.length} unit${equipment.length === 1 ? "" : "s"} on file` : "No units on file"}>
          {equipment.length === 0 ? <p className="text-sm text-zinc-500">No equipment records on file for this customer.</p> : <ul className="space-y-2">{equipment.map((asset) => <li key={asset.id}>
            <Link href={`/equipment/${asset.id}`} className="block rounded-lg border border-[#2d7dff]/15 bg-black/40 px-3 py-2 transition hover:border-[#2d7dff]/45">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-white">{asset.equipmentType}</p>
                {asset.refrigerant ? <StatusPill>{asset.refrigerant}</StatusPill> : null}
              </div>
              <p className="text-xs text-zinc-300">{[asset.manufacturer, asset.model].filter(Boolean).join(" · ") || "Make/model not recorded"}</p>
              <p className="text-[11px] text-zinc-500">Serial {asset.serialNumber ?? "not recorded"}</p>
              {asset.notes ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-300">{asset.notes}</p> : null}
              <p className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-[#8ffafa]">Full unit record<ChevronRight className="h-3 w-3" aria-hidden="true" /></p>
            </Link>
          </li>)}</ul>}
        </FoldSection>

        <FoldSection title="Before & after photos" icon={<Camera className="h-4 w-4" />} meta={photoCount ? `${photoCount} uploaded · tap a photo to view full screen` : "None yet — add proof of work"}>
          <MediaAccordion jobId={job.id} beforePhotos={job.beforePhotos} afterPhotos={job.afterPhotos} bare />
        </FoldSection>
      </div>
    </div>}
  </div>;
}
