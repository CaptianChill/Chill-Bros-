import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ClientPortalActions } from "@/components/client-portal-actions";
import { EstimateComposer } from "@/components/estimate-composer";
import { MediaAccordion } from "@/components/media-accordion";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { TechnicianJobEditor } from "@/components/technician-job-editor";
import { getEquipmentByCustomer } from "@/lib/chillbros/equipment-queries";
import { getAssignedJobsForTech } from "@/lib/chillbros/operations-queries";
import { getFeeSettings, getInvoiceByJobId, getJob, getPartsCatalog } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ job?: string }> };

export default async function TechnicianPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role !== "technician") redirect("/dispatch");

  const assignedJobs = await getAssignedJobsForTech(profile.id);
  const params = await searchParams;
  const selectedId = assignedJobs.some((item) => item.id === params.job) ? params.job! : assignedJobs[0]?.id;
  const job = selectedId ? await getJob(selectedId) : null;
  const [invoice, feeSettings, partsCatalog, equipment] = job
    ? await Promise.all([getInvoiceByJobId(job.id), getFeeSettings(), getPartsCatalog(), getEquipmentByCustomer(job.customerId)])
    : [null, [], [], []];
  const total = invoice?.lineItems.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const suggestedItems = job ? [...feeSettings.map((fee) => ({ label: fee.label, amount: fee.amount })), ...job.parts.map((part) => ({ label: `${part.name}${part.quantity > 1 ? ` x${part.quantity}` : ""}`, amount: part.retailPrice * part.quantity }))].slice(0, 10) : [];

  return (
    <AppShell title="Technician service workflow: select the call, document it, use parts, capture proof, and close it." description="Every active assigned job is available from the field queue. Job data, customer equipment, parts, photos, time, estimates, and approvals persist in production." highlight={job ? <div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Selected job</p><p className="text-2xl font-semibold text-white">{job.customerName}</p><p className="text-sm text-zinc-300">{job.location ?? "No location tagged"}</p><StatusPill tone="emerald">{job.scheduledWindow ?? job.status.replace(/_/g, " ")}</StatusPill></div> : <div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Field queue</p><p className="text-sm text-zinc-300">No active jobs assigned.</p></div>}>
      {assignedJobs.length > 0 ? <SectionCard eyebrow="My dispatch queue" title={`${assignedJobs.length} active assigned job${assignedJobs.length === 1 ? "" : "s"}`} description="Switch calls without losing saved field data."><div className="flex gap-2 overflow-x-auto pb-1">{assignedJobs.map((item) => <Link key={item.id} href={`/technician?job=${item.id}`} className={`min-w-[210px] rounded-2xl border p-3 text-sm ${item.id === selectedId ? "border-[#2d7dff] bg-[#2d7dff]/10" : "border-[#2d7dff]/20 bg-black/40"}`}><p className="font-medium text-white">{item.customerName}</p><p className="mt-1 text-xs text-zinc-400">{item.scheduledWindow ?? item.status.replace(/_/g, " ")}</p><p className="mt-1 truncate text-xs text-[#bafcfc]">{item.location ?? "No location"}</p></Link>)}</div></SectionCard> : null}
      {!job ? <SectionCard title="No active job" description="A manager assigns jobs from Dispatch. Completed and cancelled jobs leave this queue automatically."><p className="text-sm text-zinc-400">Nothing to work on yet.</p></SectionCard> : <div className="mt-6 grid gap-6 xl:grid-cols-2"><div className="space-y-6"><SectionCard eyebrow="Service ticket" title="Diagnosis, time & parts" description="Update the live service record and complete the job from the field."><div className="mb-4 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><p className="text-sm text-zinc-400">Customer</p><p className="mt-2 text-lg font-medium text-white">{job.customerName}</p><p className="mt-2 text-sm text-zinc-300">{job.location ?? "No location tagged"}</p></div><div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><p className="text-sm text-zinc-400">Dispatch scope</p><p className="mt-2 text-sm leading-6 text-white">{job.scope ?? "No scope notes yet."}</p></div></div><TechnicianJobEditor job={job} partsCatalog={partsCatalog} /></SectionCard><SectionCard eyebrow="Customer equipment" title={`${equipment.length} registered asset${equipment.length === 1 ? "" : "s"}`} description="Model, serial, refrigerant, and stored field notes for this customer.">{equipment.length === 0 ? <p className="text-sm text-zinc-500">No equipment records on file.</p> : <div className="space-y-3">{equipment.map((asset) => <div key={asset.id} className="rounded-2xl border border-[#2d7dff]/15 bg-black/40 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-white">{asset.equipmentType}</p><p className="mt-1 text-sm text-zinc-300">{[asset.manufacturer, asset.model].filter(Boolean).join(" • ") || "Manufacturer/model not recorded"}</p></div>{asset.refrigerant ? <StatusPill>{asset.refrigerant}</StatusPill> : null}</div><p className="mt-2 text-xs text-zinc-400">Serial: {asset.serialNumber ?? "not recorded"}</p>{asset.notes ? <p className="mt-2 text-sm leading-6 text-zinc-300">{asset.notes}</p> : null}</div>)}</div>}</SectionCard><SectionCard eyebrow="Proof of work" title="Before / after media" description="Capture job photos in private storage."><MediaAccordion jobId={job.id} beforePhotos={job.beforePhotos} afterPhotos={job.afterPhotos} /></SectionCard></div><SectionCard eyebrow="Customer estimate" title="Estimate, approval & payment preference" description="Create the estimate, collect signature, and retain a secure portal link.">{invoice ? <div className="space-y-5"><div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d7dff]/20 pb-3"><div><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{invoice.status === "approved" ? "Approved invoice" : "Estimate"}</p><p className="mt-1 font-medium text-white">{invoice.invoiceNumber}</p></div><StatusPill tone={invoice.status === "approved" ? "emerald" : "amber"}>{invoice.status === "approved" ? "Approved" : "Awaiting approval"}</StatusPill></div>{invoice.lineItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-b border-[#2d7dff]/10 pb-3 last:border-none last:pb-0"><p className="text-zinc-300">{item.label}</p><p className="font-medium text-white">${item.amount.toFixed(2)}</p></div>)}<div className="flex items-center justify-between border-t border-[#2d7dff]/20 pt-3"><p className="text-lg font-medium text-white">Total</p><p className="text-2xl font-semibold text-[#bafcfc]">${total.toFixed(2)}</p></div></div><ClientPortalActions invoice={invoice} /><div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-sm text-zinc-300">Secure client link: <span className="break-all text-[#bafcfc]">/portal/{invoice.portalToken}</span></div></div> : <EstimateComposer jobId={job.id} suggestedItems={suggestedItems} />}</SectionCard></div>}
    </AppShell>
  );
}
