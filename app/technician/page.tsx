import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ClientPortalActions } from "@/components/client-portal-actions";
import { EstimateComposer } from "@/components/estimate-composer";
import { MediaAccordion } from "@/components/media-accordion";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { TechnicianJobEditor } from "@/components/technician-job-editor";
import { getActiveJobForTech, getFeeSettings, getInvoiceByJobId, getPartsCatalog } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function TechnicianPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role !== "technician") redirect("/dispatch");

  const job = await getActiveJobForTech(profile.id);
  const [invoice, feeSettings, partsCatalog] = job
    ? await Promise.all([getInvoiceByJobId(job.id), getFeeSettings(), getPartsCatalog()])
    : [null, [], []];
  const total = invoice?.lineItems.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const suggestedItems = job
    ? [...feeSettings.map((fee) => ({ label: fee.label, amount: fee.amount })), ...job.parts.map((part) => ({ label: `${part.name}${part.quantity > 1 ? ` x${part.quantity}` : ""}`, amount: part.retailPrice * part.quantity }))].slice(0, 10)
    : [];

  return (
    <AppShell
      title="Technician service workflow: document the call, use parts, capture proof, and close the job."
      description="The assigned service call now stays editable from diagnosis through completion, with inventory-backed parts, photo proof, labor/drive totals, and customer estimate approval."
      highlight={job ? <div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Assigned job</p><p className="text-2xl font-semibold text-white">{job.customerName}</p><p className="text-sm text-zinc-300">{job.location ?? "No location tagged"}</p><StatusPill tone="emerald">{job.scheduledWindow ?? job.status.replace(/_/g, " ")}</StatusPill></div> : <div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Assigned job</p><p className="text-sm text-zinc-300">No job assigned right now.</p></div>}
    >
      {!job ? (
        <SectionCard title="No active job" description="A manager assigns jobs from Dispatch. Completed and cancelled jobs leave this active field view automatically."><p className="text-sm text-zinc-400">Nothing to work on yet.</p></SectionCard>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <SectionCard eyebrow="Service ticket" title="Diagnosis, time & parts" description="Update the live service record and complete the job from the field.">
              <div className="mb-4 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><p className="text-sm text-zinc-400">Customer</p><p className="mt-2 text-lg font-medium text-white">{job.customerName}</p><p className="mt-2 text-sm text-zinc-300">{job.location ?? "No location tagged"}</p></div><div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><p className="text-sm text-zinc-400">Dispatch scope</p><p className="mt-2 text-sm leading-6 text-white">{job.scope ?? "No scope notes yet."}</p></div></div>
              <TechnicianJobEditor job={job} partsCatalog={partsCatalog} />
            </SectionCard>
            <SectionCard eyebrow="Proof of work" title="Before / after media" description="Capture job photos in the private Chill Bros storage bucket."><MediaAccordion jobId={job.id} beforePhotos={job.beforePhotos} afterPhotos={job.afterPhotos} /></SectionCard>
          </div>

          <SectionCard eyebrow="Customer estimate" title="Estimate, approval & payment preference" description="Create an atomic estimate, collect the customer signature, and retain a secure portal link.">
            {invoice ? <div className="space-y-5"><div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d7dff]/20 pb-3"><div><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{invoice.status === "approved" ? "Approved invoice" : "Estimate"}</p><p className="mt-1 font-medium text-white">{invoice.invoiceNumber}</p></div><StatusPill tone={invoice.status === "approved" ? "emerald" : "amber"}>{invoice.status === "approved" ? "Approved" : "Awaiting approval"}</StatusPill></div>{invoice.lineItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-b border-[#2d7dff]/10 pb-3 last:border-none last:pb-0"><p className="text-zinc-300">{item.label}</p><p className="font-medium text-white">${item.amount.toFixed(2)}</p></div>)}<div className="flex items-center justify-between border-t border-[#2d7dff]/20 pt-3"><p className="text-lg font-medium text-white">Total</p><p className="text-2xl font-semibold text-[#bafcfc]">${total.toFixed(2)}</p></div></div><ClientPortalActions invoice={invoice} /><div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-sm text-zinc-300">Secure client link: <span className="break-all text-[#bafcfc]">/portal/{invoice.portalToken}</span></div></div> : <EstimateComposer jobId={job.id} suggestedItems={suggestedItems} />}
          </SectionCard>
        </div>
      )}
    </AppShell>
  );
}
