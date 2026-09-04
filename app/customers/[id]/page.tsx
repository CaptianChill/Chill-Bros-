import Link from "next/link";
import { FileText, Wrench } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CustomerEditor } from "@/components/customer-editor";
import { EquipmentAdmin } from "@/components/equipment-admin";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getCustomerProfile } from "@/lib/chillbros/customer-profile";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function CustomerProfilePage({ params }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const { id } = await params;
  const data = await getCustomerProfile(id);
  if (!data) notFound();
  const activeJobs = data.jobs.filter((job) => !job.archivedAt && ["scheduled", "in_progress"].includes(job.status));
  const activePlans = data.agreements.filter((plan) => ["accepted", "active"].includes(plan.status));

  return <AppShell
    title={data.customer.name}
    description="Customer information, service history, dispatch activity, equipment asset tags, and monthly plan agreements in one record."
    highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Customer profile</p><StatusPill tone="emerald">{data.equipment.length} assets</StatusPill><StatusPill>{activeJobs.length} open calls</StatusPill><StatusPill>{activePlans.length} active plans</StatusPill></div>}
  >
    <div className="space-y-4">
      <SectionCard eyebrow="Customer record" title="Contact & service history" description="Edit the customer record here. All equipment and plans below remain tied to this customer ID."><CustomerEditor customer={data.customer} /></SectionCard>

      <SectionCard eyebrow="Equipment" title="Customer asset registry" description="Add, tag, and maintain equipment directly under this customer record."><EquipmentAdmin customers={[data.customer]} equipment={data.equipment} canDelete={profile.role === "manager"} /></SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard eyebrow="Service calls" title="Dispatch & service history" description="Current and historical calls for this customer.">
          {data.jobs.length === 0 ? <p className="text-sm text-zinc-500">No service calls yet.</p> : <div className="space-y-2">{data.jobs.map((job) => <details key={job.id} className={`rounded-xl border p-3 ${job.archivedAt ? "border-zinc-700 bg-zinc-950/40 opacity-70" : "border-[#2d7dff]/15 bg-black/40"}`}><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-[#8ffafa]" /><div><p className="text-sm font-medium text-white">{job.scheduledWindow ?? new Date(job.createdAt).toLocaleDateString("en-US")}</p><p className="text-xs text-zinc-500">{job.assignedTechName ?? "Unassigned"} • {job.location ?? "No location"}</p></div></div><StatusPill tone={job.status === "completed" ? "emerald" : job.status === "cancelled" ? "rose" : "amber"}>{job.archivedAt ? "archived" : job.status.replace(/_/g, " ")}</StatusPill></summary><div className="mt-3 space-y-2 text-sm text-zinc-300">{job.scope ? <p><span className="text-zinc-500">Scope:</span> {job.scope}</p> : null}{job.workPerformed ? <p className="whitespace-pre-wrap"><span className="text-zinc-500">Work:</span> {job.workPerformed}</p> : null}</div></details>)}</div>}
        </SectionCard>

        <SectionCard eyebrow="Monthly plans" title="Service agreements" description="Saved custom plans and customer-facing quote documents.">
          <div className="mb-3 flex flex-wrap gap-2"><Link href="/agreements" className="rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]">Create / edit monthly plan</Link></div>
          {data.agreements.length === 0 ? <p className="text-sm text-zinc-500">No monthly plans saved for this customer.</p> : <div className="space-y-2">{data.agreements.map((plan) => <div key={plan.id} className="rounded-xl border border-[#2d7dff]/15 bg-black/40 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium text-white">{plan.title}</p><p className="mt-1 text-xs text-zinc-500">{plan.agreementNumber} • {plan.monthlyTotal.toLocaleString("en-US", { style: "currency", currency: "USD" })}/month</p></div><StatusPill tone={plan.status === "active" || plan.status === "accepted" ? "emerald" : plan.status === "cancelled" ? "rose" : "amber"}>{plan.status}</StatusPill></div><div className="mt-3 flex flex-wrap gap-2"><Link href={`/agreement/${plan.portalToken}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d7dff]/25 px-2.5 py-1.5 text-xs text-[#d9fbff]"><FileText className="h-3.5 w-3.5" />Customer quote</Link><Link href={`/agreement/${plan.portalToken}/document`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d7dff]/25 px-2.5 py-1.5 text-xs text-[#d9fbff]">Printable document</Link></div></div>)}</div>}
        </SectionCard>
      </div>
    </div>
  </AppShell>;
}
