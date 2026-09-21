import Link from "next/link";
import { Archive, FilePenLine, FileText, Wrench } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CustomerEditor } from "@/components/customer-editor";
import { EquipmentAdmin } from "@/components/equipment-admin";
import { JobDispatchControl } from "@/components/job-dispatch-control";
import { OpenFormDrafts } from "@/components/open-form-drafts";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getCustomerProfile } from "@/lib/chillbros/customer-profile";
import { getActiveTechnicians } from "@/lib/chillbros/operations-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function CustomerProfilePage({ params }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const { id } = await params;
  const [data, technicians] = await Promise.all([getCustomerProfile(id), getActiveTechnicians()]);
  if (!data) notFound();
  const activeJobs = data.jobs.filter((job) => !job.archivedAt && ["scheduled", "in_progress"].includes(job.status));
  const activePlans = data.agreements.filter((plan) => ["accepted", "active"].includes(plan.status));
  const openDocuments = data.documents.filter((document) => document.paymentStatus !== "paid" && document.status !== "void");
  const archivedDocuments = data.documents.filter((document) => document.paymentStatus === "paid" || document.status === "void");

  return <AppShell
    title={data.customer.name}
    description="Customer information, open work, saved forms, billing history, service history, equipment, and monthly plans in one record."
    highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Customer profile</p><StatusPill tone="emerald">{data.equipment.length} assets</StatusPill><StatusPill>{activeJobs.length} open calls</StatusPill><StatusPill tone={openDocuments.length ? "amber" : "emerald"}>{openDocuments.length} open documents</StatusPill><StatusPill>{activePlans.length} active plans</StatusPill></div>}
  >
    <div className="space-y-4">
      <SectionCard eyebrow="Customer record" title="Contact & service history" description="Edit the customer record here. All equipment, documents, calls, and plans remain tied to this customer ID."><CustomerEditor customer={data.customer} /></SectionCard>

      <SectionCard eyebrow="Open / In Progress" title="Saved work for this customer" description="Anything unfinished stays easy to find here. Completed billing is kept out of the way below in the archive.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Open documents</p><div className="flex gap-2"><Link href={`/invoices/new?type=quote&customer=${encodeURIComponent(data.customer.id)}`} className="rounded-lg border border-[#2d7dff]/25 px-2.5 py-1.5 text-xs text-[#d9fbff]">+ New Quote</Link><Link href={`/invoices/new?type=invoice&customer=${encodeURIComponent(data.customer.id)}`} className="rounded-lg border border-[#2d7dff]/25 px-2.5 py-1.5 text-xs text-[#d9fbff]">+ New Invoice</Link></div></div>
            {openDocuments.length === 0 ? <p className="text-sm text-zinc-500">No unpaid or unfinished billing documents.</p> : openDocuments.map((document) => {
              const linkedJob = document.jobId ? data.jobs.find((job) => job.id === document.jobId) : null;
              const jobIsFieldActive = Boolean(linkedJob && !linkedJob.archivedAt && ["scheduled", "in_progress"].includes(linkedJob.status));
              const editHref = document.status === "approved" ? `/invoices?focus=${encodeURIComponent(document.id)}` : jobIsFieldActive ? `/technician?job=${encodeURIComponent(document.jobId!)}` : `/invoices?focus=${encodeURIComponent(document.id)}&edit=1`;
              return <div key={document.id} className="rounded-xl border border-[#2d7dff]/15 bg-black/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="inline-flex items-center gap-2 font-medium text-white"><FilePenLine className="h-4 w-4 text-[#8ffafa]" />{document.invoiceNumber}</p><p className="mt-1 text-xs text-zinc-500">{document.status.replace(/_/g, " ")} • {document.paymentStatus.replace(/_/g, " ")}</p></div><StatusPill tone={document.status === "approved" ? "emerald" : "amber"}>{document.status === "approved" ? "ready / unpaid" : "in progress"}</StatusPill></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3"><Link href={`/portal/${document.portalToken}/document`} target="_blank" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#2d7dff]/25 px-2.5 py-2 text-xs text-[#d9fbff]"><FileText className="h-3.5 w-3.5" />Open</Link><Link href={editHref} className="inline-flex items-center justify-center rounded-lg border border-[#8ffafa]/35 bg-[#2d7dff]/10 px-2.5 py-2 text-xs font-semibold text-[#d9fbff]">{document.status === "approved" ? "Manage" : "Edit / Continue"}</Link><Link href={`/portal/${document.portalToken}`} target="_blank" className="inline-flex items-center justify-center rounded-lg border border-[#2d7dff]/25 px-2.5 py-2 text-xs text-[#d9fbff]">Customer view</Link></div>
              </div>;
            })}
          </div>
          <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Saved form drafts</p><OpenFormDrafts customerId={data.customer.id} profileId={profile.id} /></div>
        </div>
      </SectionCard>

      <details className="rounded-2xl border border-zinc-800 bg-black/35 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div className="flex items-center gap-2"><Archive className="h-4 w-4 text-zinc-400"/><div><p className="font-semibold text-white">Past billing archive</p><p className="text-xs text-zinc-500">Paid and void invoices / quotes stay stored here, hidden until you need them.</p></div></div><span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400">{archivedDocuments.length}</span></summary>
        <div className="mt-3 space-y-2">{archivedDocuments.length === 0 ? <p className="text-sm text-zinc-500">No archived billing yet.</p> : archivedDocuments.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/55 p-3"><div><p className="text-sm font-medium text-white">{document.invoiceNumber}</p><p className="mt-1 text-xs text-zinc-500">{document.paymentStatus === "paid" ? "Paid" : "Void"}</p></div><div className="flex gap-2">{document.status !== "void" ? <Link href={`/portal/${document.portalToken}/document`} target="_blank" className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300">Document</Link> : null}<Link href={`/invoices?focus=${encodeURIComponent(document.id)}`} className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300">Record</Link></div></div>)}</div>
      </details>

      <SectionCard eyebrow="Equipment" title="Customer asset registry" description="Add, tag, and maintain equipment directly under this customer record."><EquipmentAdmin customers={[data.customer]} equipment={data.equipment} canDelete={profile.role === "manager"} /></SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard eyebrow="Service calls" title="Dispatch & service history" description="Current and historical calls for this customer.">
          {data.jobs.length === 0 ? <p className="text-sm text-zinc-500">No service calls yet.</p> : <div className="space-y-2">{data.jobs.map((job) => <details key={job.id} className={`rounded-xl border p-3 ${job.archivedAt ? "border-zinc-700 bg-zinc-950/40 opacity-70" : "border-[#2d7dff]/15 bg-black/40"}`}><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-[#8ffafa]" /><div><p className="text-sm font-medium text-white">{job.scheduledWindow ?? new Date(job.createdAt).toLocaleDateString("en-US")}</p><p className="text-xs text-zinc-500">{job.assignedTechName ?? "Unassigned"} • {job.location ?? "No location"}</p></div></div><StatusPill tone={job.status === "completed" ? "emerald" : job.status === "cancelled" ? "rose" : "amber"}>{job.archivedAt ? "archived" : job.status.replace(/_/g, " ")}</StatusPill></summary><div className="mt-3 space-y-2 text-sm text-zinc-300">{job.scope ? <p><span className="text-zinc-500">Scope:</span> {job.scope}</p> : null}{job.workPerformed ? <p className="whitespace-pre-wrap"><span className="text-zinc-500">Work:</span> {job.workPerformed}</p> : null}{!job.archivedAt && ["scheduled", "in_progress"].includes(job.status) ? <>
                <Link href={`/technician?job=${encodeURIComponent(job.id)}`} className="mt-2 inline-flex rounded-lg border border-[#8ffafa]/35 bg-[#2d7dff]/10 px-3 py-2 text-xs font-semibold text-[#d9fbff]">Edit / Continue call</Link>
                <JobDispatchControl jobId={job.id} currentTechId={job.assignedTechId} technicians={technicians} />
              </> : null}</div></details>)}</div>}
        </SectionCard>

        <SectionCard eyebrow="Monthly plans" title="Service agreements" description="Saved custom plans and customer-facing quote documents.">
          <div className="mb-3 flex flex-wrap gap-2"><Link href="/agreements" className="rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]">Create / edit monthly plan</Link></div>
          {data.agreements.length === 0 ? <p className="text-sm text-zinc-500">No monthly plans saved for this customer.</p> : <div className="space-y-2">{data.agreements.map((plan) => <div key={plan.id} className="rounded-xl border border-[#2d7dff]/15 bg-black/40 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium text-white">{plan.title}</p><p className="mt-1 text-xs text-zinc-500">{plan.agreementNumber} • {plan.monthlyTotal.toLocaleString("en-US", { style: "currency", currency: "USD" })}/month</p></div><StatusPill tone={plan.status === "active" || plan.status === "accepted" ? "emerald" : plan.status === "cancelled" ? "rose" : "amber"}>{plan.status}</StatusPill></div><div className="mt-3 flex flex-wrap gap-2"><Link href={`/agreement/${plan.portalToken}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d7dff]/25 px-2.5 py-1.5 text-xs text-[#d9fbff]"><FileText className="h-3.5 w-3.5" />Customer quote</Link><Link href={`/agreement/${plan.portalToken}/document`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d7dff]/25 px-2.5 py-1.5 text-xs text-[#d9fbff]">Printable document</Link><Link href="/agreements" className="inline-flex items-center rounded-lg border border-[#8ffafa]/35 bg-[#2d7dff]/10 px-2.5 py-1.5 text-xs font-semibold text-[#d9fbff]">Edit / Continue</Link></div></div>)}</div>}
        </SectionCard>
      </div>
    </div>
  </AppShell>;
}
