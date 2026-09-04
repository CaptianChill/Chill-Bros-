import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ClientPortalActions } from "@/components/client-portal-actions";
import { EstimateAdjustmentsEditor } from "@/components/estimate-adjustments-editor";
import { EstimateComposer } from "@/components/estimate-composer";
import { MediaAccordion } from "@/components/media-accordion";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { TechnicianJobEditor } from "@/components/technician-job-editor";
import { getEquipmentByCustomer } from "@/lib/chillbros/equipment-queries";
import { getInvoiceV2ByJobId, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { getAssignedJobsForTech } from "@/lib/chillbros/operations-queries";
import { getFeeSettings, getJob, getPartsCatalog } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ job?: string }> };
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default async function TechnicianPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role !== "technician") redirect("/dispatch");

  const assignedJobs = await getAssignedJobsForTech(profile.id);
  const params = await searchParams;
  const selectedId = assignedJobs.some((item) => item.id === params.job) ? params.job! : assignedJobs[0]?.id;
  const job = selectedId ? await getJob(selectedId) : null;
  const [invoice, feeSettings, partsCatalog, equipment] = job
    ? await Promise.all([getInvoiceV2ByJobId(job.id), getFeeSettings(), getPartsCatalog(), getEquipmentByCustomer(job.customerId)])
    : [null, [], [], []];
  const totals = invoice ? invoiceTotals(invoice) : null;
  const suggestedItems = job ? [
    ...feeSettings.map((fee) => ({ label: fee.label, description: "Service fee", quantity: 1, unitPrice: fee.amount })),
    ...job.parts.map((part) => ({ label: part.name, description: part.partNumber || "Inventory part", quantity: part.quantity, unitPrice: part.retailPrice })),
  ].slice(0, 20) : [];

  return <AppShell
    title="Technician service workflow: select the call, document it, use parts, capture proof, and close it."
    description="Every active assigned job is available from the field queue. Notes autosave, parts update inventory, estimates flow to customer approval, and office status stays synchronized."
    highlight={job ? <div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Selected job</p><p className="text-2xl font-semibold text-white">{job.customerName}</p><p className="text-sm text-zinc-300">{job.location ?? "No location tagged"}</p><StatusPill tone="emerald">{job.scheduledWindow ?? job.status.replace(/_/g, " ")}</StatusPill></div> : <div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Field queue</p><p className="text-sm text-zinc-300">No active jobs assigned.</p></div>}
  >
    {assignedJobs.length > 0 ? <SectionCard eyebrow="My dispatch queue" title={`${assignedJobs.length} active assigned job${assignedJobs.length === 1 ? "" : "s"}`} description="Switch calls without losing saved field data."><div className="flex gap-2 overflow-x-auto pb-1">{assignedJobs.map((item) => <Link key={item.id} href={`/technician?job=${item.id}`} className={`min-w-[210px] rounded-2xl border p-3 text-sm ${item.id === selectedId ? "border-[#2d7dff] bg-[#2d7dff]/10" : "border-[#2d7dff]/20 bg-black/40"}`}><p className="font-medium text-white">{item.customerName}</p><p className="mt-1 text-xs text-zinc-400">{item.scheduledWindow ?? item.status.replace(/_/g, " ")}</p><p className="mt-1 truncate text-xs text-[#bafcfc]">{item.location ?? "No location"}</p></Link>)}</div></SectionCard> : null}

    {!job ? <SectionCard title="No active job" description="A manager assigns jobs from Dispatch. Completed and cancelled jobs leave this queue automatically."><p className="text-sm text-zinc-400">Nothing to work on yet.</p></SectionCard> : <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <SectionCard eyebrow="Service ticket" title="Diagnosis, time & parts" description="Text, hours, status, and parts persist into the live service record."><div className="mb-4 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3"><p className="text-sm text-zinc-400">Customer</p><p className="mt-1 text-lg font-medium text-white">{job.customerName}</p><p className="mt-1 text-sm text-zinc-300">{job.location ?? "No location tagged"}</p></div><div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3"><p className="text-sm text-zinc-400">Dispatch scope</p><p className="mt-1 text-sm leading-6 text-white">{job.scope ?? "No scope notes yet."}</p></div></div><TechnicianJobEditor job={job} partsCatalog={partsCatalog} /></SectionCard>
        <SectionCard eyebrow="Customer equipment" title={`${equipment.length} registered asset${equipment.length === 1 ? "" : "s"}`} description="Model, serial, refrigerant, and stored field notes for this customer.">{equipment.length === 0 ? <p className="text-sm text-zinc-500">No equipment records on file.</p> : <details className="group"><summary className="cursor-pointer text-sm text-[#bafcfc]">Show equipment details</summary><div className="mt-3 space-y-3">{equipment.map((asset) => <div key={asset.id} className="rounded-2xl border border-[#2d7dff]/15 bg-black/40 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-white">{asset.equipmentType}</p><p className="mt-1 text-sm text-zinc-300">{[asset.manufacturer, asset.model].filter(Boolean).join(" • ") || "Manufacturer/model not recorded"}</p></div>{asset.refrigerant ? <StatusPill>{asset.refrigerant}</StatusPill> : null}</div><p className="mt-2 text-xs text-zinc-400">Serial: {asset.serialNumber ?? "not recorded"}</p>{asset.notes ? <p className="mt-2 text-sm leading-6 text-zinc-300">{asset.notes}</p> : null}</div>)}</div></details>}</SectionCard>
        <SectionCard eyebrow="Proof of work" title="Before / after media" description="Capture job photos in private storage."><MediaAccordion jobId={job.id} beforePhotos={job.beforePhotos} afterPhotos={job.afterPhotos} /></SectionCard>
      </div>

      <SectionCard eyebrow="Customer estimate" title="Estimate → approval → invoice" description="Build pricing, apply discount/deposit terms, send the secure customer view, and follow approval status.">
        {invoice ? <div className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d7dff]/20 pb-3"><div><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{invoice.status === "approved" ? "Approved invoice" : "Estimate"}</p><p className="mt-1 font-medium text-white">{invoice.invoiceNumber}</p></div><StatusPill tone={invoice.status === "approved" ? "emerald" : "amber"}>{invoice.status === "approved" ? "Approved" : "Awaiting approval"}</StatusPill></div>
            {invoice.lineItems.map((item) => <div key={item.id} className="border-b border-[#2d7dff]/10 pb-3 last:border-none"><div className="flex items-start justify-between gap-3"><div><p className="text-zinc-200">{item.label}</p>{item.description ? <p className="mt-1 text-xs leading-5 text-zinc-500">{item.description}</p> : null}<p className="mt-1 text-xs text-[#bafcfc]">Qty {item.quantity:g} × {money(item.unitPrice)}</p></div><p className="font-medium text-white">{money(item.amount)}</p></div></div>)}
            {totals ? <div className="space-y-2 border-t border-[#2d7dff]/20 pt-3 text-sm"><div className="flex justify-between"><span className="text-zinc-400">Subtotal</span><span>{money(totals.subtotal)}</span></div>{invoice.discountAmount > 0 ? <div className="flex justify-between text-emerald-200"><span>Discount</span><span>−{money(invoice.discountAmount)}</span></div> : null}<div className="flex justify-between text-lg font-medium text-white"><span>Total</span><span className="text-[#bafcfc]">{money(totals.total)}</span></div>{invoice.downPaymentAmount > 0 ? <><div className="flex justify-between text-amber-100"><span>Down payment required</span><span>{money(invoice.downPaymentAmount)}</span></div><div className="flex justify-between"><span className="text-zinc-400">Balance after down payment</span><span>{money(totals.balanceAfterDownPayment)}</span></div></> : null}</div> : null}
          </div>
          <EstimateAdjustmentsEditor invoice={invoice} />
          <ClientPortalActions invoice={invoice} />
          <div className="grid gap-2 sm:grid-cols-2"><Link href={`/portal/${invoice.portalToken}`} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-sm text-[#d9fbff]"><ExternalLink className="h-4 w-4" />Open secure client view</Link><Link href={`/portal/${invoice.portalToken}/document`} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-sm text-[#d9fbff]"><FileText className="h-4 w-4" />Fullscreen document</Link></div>
        </div> : <EstimateComposer jobId={job.id} suggestedItems={suggestedItems} />}
      </SectionCard>
    </div>}
  </AppShell>;
}
