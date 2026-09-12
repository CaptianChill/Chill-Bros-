import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ClientPortalActions } from "@/components/client-portal-actions";
import { EstimateAdjustmentsEditor } from "@/components/estimate-adjustments-editor";
import { EstimateComposer } from "@/components/estimate-composer";
import { MediaAccordion } from "@/components/media-accordion";
import { OwnerEstimateEditor } from "@/components/owner-estimate-editor";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { TechnicianJobEditor } from "@/components/technician-job-editor";
import { getEquipmentByCustomer } from "@/lib/chillbros/equipment-queries";
import { getInvoiceV2ByJobId, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getFeeSettings, getJob, getPartsCatalog } from "@/lib/chillbros/queries";
import { getAssignedFieldJobsForTechnician } from "@/lib/chillbros/technician-assignment";
import { JOB_ACTIVE_STATUSES, JOB_STATUS_LABELS } from "@/lib/chillbros/types";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ job?: string }> };
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

const FIELD_VISIBLE = new Set([
  "scheduled",
  "in_progress",
  "dispatched",
  "en_route",
  "arrived",
  "diagnosing",
  "awaiting_approval",
  "approved",
  "parts_required",
  "return_visit_needed",
  "repairing",
  "work_complete",
  "ready_to_invoice",
]);

export default async function TechnicianPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (!["technician", "manager"].includes(profile.role)) redirect("/dispatch");
  const isManager = profile.role === "manager";

  const allJobs = isManager
    ? await getDispatchJobs(250)
    : await getAssignedFieldJobsForTechnician({ id: profile.id, email: profile.email }, 250);
  const fieldJobs = allJobs.filter((job) =>
    JOB_ACTIVE_STATUSES.includes(job.status) && FIELD_VISIBLE.has(job.status),
  );

  const params = await searchParams;
  const requestedId = fieldJobs.some((item) => item.id === params.job) ? params.job! : null;
  const managerOwnJob = isManager ? fieldJobs.find((item) => item.assignedTechId === profile.id)?.id : null;
  const selectedId = requestedId ?? managerOwnJob ?? fieldJobs[0]?.id;
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
    title={isManager ? "Owner field command: run your calls or step into any active technician job." : "Technician Today: work the next call from dispatch through completion."}
    description={isManager ? "Every live field stage is visible here. Owner updates stay in the same service record and audit trail." : "One service record follows the call from dispatch to driving, arrival, diagnosis, approval, repair, and invoice handoff."}
    highlight={job ? <div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">{isManager ? "Owner field override" : "Current call"}</p><p className="text-2xl font-semibold text-white">{job.customerName}</p><p className="text-sm text-zinc-300">{job.location ?? "No location tagged"}</p><StatusPill tone="emerald">{JOB_STATUS_LABELS[job.status]}</StatusPill>{job.scheduledWindow ? <StatusPill>{job.scheduledWindow}</StatusPill> : null}{isManager ? <StatusPill>{job.assignedTechName ? `Assigned: ${job.assignedTechName}` : "Unassigned call"}</StatusPill> : null}</div> : <div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Field queue</p><p className="text-sm text-zinc-300">No active field jobs available.</p></div>}
  >
    {fieldJobs.length > 0 ? <SectionCard eyebrow={isManager ? "Field command" : "My day"} title={`${fieldJobs.length} active field job${fieldJobs.length === 1 ? "" : "s"}`} description={isManager ? "Open any live technician call without creating another work order." : "Your assigned jobs stay here through the full field lifecycle."}>
      <div className="flex gap-2 overflow-x-auto pb-1">{fieldJobs.map((item) => <Link key={item.id} href={`/technician?job=${item.id}`} className={`min-w-[230px] rounded-2xl border p-3 text-sm transition ${item.id === selectedId ? "border-[#2d7dff] bg-[#2d7dff]/12" : "border-[#2d7dff]/20 bg-black/40 hover:border-[#2d7dff]/45"}`}><div className="flex items-start justify-between gap-2"><p className="font-medium text-white">{item.customerName}</p><span className="text-[10px] uppercase tracking-[0.12em] text-[#bafcfc]">{JOB_STATUS_LABELS[item.status]}</span></div><p className="mt-1 text-xs text-zinc-400">{item.scheduledWindow ?? "No time window"}</p><p className="mt-1 truncate text-xs text-zinc-300">{item.location ?? "No location"}</p>{isManager ? <p className="mt-2 truncate text-[10px] uppercase tracking-[0.12em] text-zinc-500">{item.assignedTechName ?? "Unassigned"}</p> : null}</Link>)}</div>
    </SectionCard> : null}

    {!job ? <SectionCard title="No active field job" description={isManager ? "Create or assign a call from Dispatch." : "Assigned calls appear here automatically and remain visible through the field workflow."}><p className="text-sm text-zinc-400">Nothing to work on right now.</p></SectionCard> : <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <SectionCard eyebrow="Service workflow" title="Run this call" description="Use the large stage action first. Notes and time autosave underneath.">
          <div className="mb-4 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3"><p className="text-sm text-zinc-400">Customer</p><p className="mt-1 text-lg font-medium text-white">{job.customerName}</p><p className="mt-1 text-sm text-zinc-300">{job.location ?? "No location tagged"}</p>{job.scheduledWindow ? <p className="mt-2 text-xs text-[#bafcfc]">{job.scheduledWindow}</p> : null}</div><div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3"><p className="text-sm text-zinc-400">Dispatch complaint / scope</p><p className="mt-1 text-sm leading-6 text-white">{job.scope ?? "No scope notes yet."}</p></div></div>
          <TechnicianJobEditor job={job} partsCatalog={partsCatalog} />
        </SectionCard>

        <SectionCard eyebrow="Customer equipment" title={`${equipment.length} registered asset${equipment.length === 1 ? "" : "s"}`} description="Model, serial, refrigerant, and stored field notes stay beside the active service call.">
          {equipment.length === 0 ? <p className="text-sm text-zinc-500">No equipment records on file.</p> : <div className="space-y-3">{equipment.map((asset) => <div key={asset.id} className="rounded-2xl border border-[#2d7dff]/15 bg-black/40 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-white">{asset.equipmentType}</p><p className="mt-1 text-sm text-zinc-300">{[asset.manufacturer, asset.model].filter(Boolean).join(" • ") || "Manufacturer/model not recorded"}</p></div>{asset.refrigerant ? <StatusPill>{asset.refrigerant}</StatusPill> : null}</div><p className="mt-2 text-xs text-zinc-400">Serial: {asset.serialNumber ?? "not recorded"}</p>{asset.notes ? <p className="mt-2 text-sm leading-6 text-zinc-300">{asset.notes}</p> : null}</div>)}</div>}
        </SectionCard>

        <SectionCard eyebrow="Proof of work" title="Before / after media" description="Capture field proof against the same job record."><MediaAccordion jobId={job.id} beforePhotos={job.beforePhotos} afterPhotos={job.afterPhotos} /></SectionCard>
      </div>

      <SectionCard eyebrow={isManager ? "Owner pricing" : "Customer approval"} title="Estimate → approval → invoice" description={isManager ? "Create, revise, approve, and hand the completed call into billing without leaving the service record." : "Build the estimate, send the customer view, and continue the job after approval."}>
        {invoice ? <div className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d7dff]/20 pb-3"><div><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{invoice.status === "approved" ? "Approved invoice" : "Estimate"}</p><p className="mt-1 font-medium text-white">{invoice.invoiceNumber}</p></div><StatusPill tone={invoice.status === "approved" ? "emerald" : "amber"}>{invoice.status === "approved" ? "Approved" : "Awaiting approval"}</StatusPill></div>
            {invoice.lineItems.map((item) => <div key={item.id} className="border-b border-[#2d7dff]/10 pb-3 last:border-none"><div className="flex items-start justify-between gap-3"><div><p className="text-zinc-200">{item.label}</p>{item.description ? <p className="mt-1 text-xs leading-5 text-zinc-500">{item.description}</p> : null}<p className="mt-1 text-xs text-[#bafcfc]">Qty {item.quantity} × {money(item.unitPrice)}{item.taxable ? " • taxable" : ""}</p></div><p className="font-medium text-white">{money(item.amount)}</p></div></div>)}
            {totals ? <div className="space-y-2 border-t border-[#2d7dff]/20 pt-3 text-sm"><div className="flex justify-between"><span className="text-zinc-400">Subtotal</span><span>{money(totals.subtotal)}</span></div>{invoice.discountAmount > 0 ? <div className="flex justify-between text-emerald-200"><span>Discount</span><span>−{money(invoice.discountAmount)}</span></div> : null}{invoice.taxAmount > 0 ? <div className="flex justify-between"><span className="text-zinc-400">Tax</span><span>{money(invoice.taxAmount)}</span></div> : null}<div className="flex justify-between text-lg font-medium text-white"><span>Total</span><span className="text-[#bafcfc]">{money(totals.total)}</span></div>{invoice.downPaymentAmount > 0 ? <><div className="flex justify-between text-amber-100"><span>Down payment required</span><span>{money(invoice.downPaymentAmount)}</span></div><div className="flex justify-between"><span className="text-zinc-400">Balance after down payment</span><span>{money(totals.balanceAfterDownPayment)}</span></div></> : null}</div> : null}
          </div>
          {isManager && invoice.status !== "approved" ? <OwnerEstimateEditor invoice={invoice} /> : null}
          <EstimateAdjustmentsEditor invoice={invoice} />
          {isManager && invoice.status === "approved" ? <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-3 text-sm text-amber-100"><p className="font-medium">Customer-approved pricing</p><p className="mt-1 text-xs leading-5 text-zinc-400">Approved pricing remains locked from silent rewrites. Use Invoice Center for audited corrections.</p><Link href="/invoices" className="mt-2 inline-flex rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]">Open Invoice Center</Link></div> : null}
          <ClientPortalActions invoice={invoice} />
          <div className="grid gap-2 sm:grid-cols-2"><Link href={`/portal/${invoice.portalToken}`} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-sm text-[#d9fbff]"><ExternalLink className="h-4 w-4" />Open customer view</Link><Link href={`/portal/${invoice.portalToken}/document`} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-sm text-[#d9fbff]"><FileText className="h-4 w-4" />Fullscreen document</Link></div>
        </div> : <EstimateComposer jobId={job.id} suggestedItems={suggestedItems} />}
      </SectionCard>
    </div>}
  </AppShell>;
}
