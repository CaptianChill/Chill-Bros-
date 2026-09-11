import Link from "next/link";
import { ArrowLeft, ClipboardList, ReceiptText, Wrench } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getEquipmentServiceRecord } from "@/lib/chillbros/equipment-service-record";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

const when = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const label = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default async function EquipmentServiceRecordPage({ params }: Props) {
  const [{ id }, profile] = await Promise.all([params, getCurrentStaffProfile()]);
  if (!profile) redirect("/sign-in");
  if (!["manager", "office", "technician"].includes(profile.role)) redirect("/");

  const record = await getEquipmentServiceRecord(id);
  if (!record) notFound();
  const { equipment, jobs, events } = record;

  return <AppShell title="Equipment Service Record" description="One permanent asset history for every Chill Bros visit, diagnosis, repair, quote, invoice and return trip.">
    <div className="space-y-4">
      <Link href="/equipment" className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/25 bg-black/35 px-3 py-2 text-sm text-[#d9fbff]"><ArrowLeft className="h-4 w-4" />Equipment Center</Link>

      <section className="rounded-3xl border border-[#2d7dff]/30 bg-black/50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8ffafa]">{equipment.assetTag ?? "Unnumbered asset"}</p><h1 className="mt-1 text-3xl font-semibold text-white">{[equipment.manufacturer, equipment.model].filter(Boolean).join(" ") || equipment.equipmentType}</h1><p className="mt-2 text-sm text-zinc-400">{equipment.customerName} · {equipment.equipmentType}</p></div>
          <div className="flex flex-wrap gap-2">{equipment.refrigerant ? <StatusPill>{equipment.refrigerant}</StatusPill> : null}<StatusPill tone="emerald">{jobs.length} service {jobs.length === 1 ? "job" : "jobs"}</StatusPill></div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-[#2d7dff]/15 bg-black/35 p-3"><p className="text-xs text-zinc-500">Serial</p><p className="mt-1 text-sm text-white">{equipment.serialNumber ?? "Not recorded"}</p></div><div className="rounded-xl border border-[#2d7dff]/15 bg-black/35 p-3"><p className="text-xs text-zinc-500">Manufacturer</p><p className="mt-1 text-sm text-white">{equipment.manufacturer ?? "Not recorded"}</p></div><div className="rounded-xl border border-[#2d7dff]/15 bg-black/35 p-3"><p className="text-xs text-zinc-500">Model</p><p className="mt-1 text-sm text-white">{equipment.model ?? "Not recorded"}</p></div></div>
        {equipment.notes ? <p className="mt-4 rounded-xl border border-zinc-800 bg-black/30 p-3 text-sm leading-6 text-zinc-300">{equipment.notes}</p> : null}
      </section>

      <SectionCard eyebrow="Asset history" title="Service timeline" description="Every linked service call remains attached to this exact piece of equipment.">
        <div className="space-y-3">{jobs.length === 0 ? <p className="text-sm text-zinc-500">No service calls have been linked to this asset yet.</p> : jobs.map((job) => <Link key={job.id} href={`/jobs/${job.id}`} className="block rounded-2xl border border-[#2d7dff]/15 bg-black/40 p-4 transition hover:border-[#8ffafa]/35"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-white">{job.scope || "Service call"}</p><p className="mt-1 text-xs text-zinc-500">{when(job.createdAt)} · {job.technicianName ?? "Unassigned"}</p></div><StatusPill>{label(job.status)}</StatusPill></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-zinc-800 bg-black/35 p-2.5 text-xs text-zinc-300"><ClipboardList className="mr-1 inline h-3.5 w-3.5 text-[#8ffafa]" />{job.scheduledWindow ?? "No schedule saved"}</div><div className="rounded-xl border border-zinc-800 bg-black/35 p-2.5 text-xs text-zinc-300"><Wrench className="mr-1 inline h-3.5 w-3.5 text-[#8ffafa]" />{job.laborHours} hr labor · {job.driveHours} hr drive</div><div className="rounded-xl border border-zinc-800 bg-black/35 p-2.5 text-xs text-zinc-300"><ReceiptText className="mr-1 inline h-3.5 w-3.5 text-[#8ffafa]" />{job.invoiceNumber ?? "No invoice"}{job.paymentStatus ? ` · ${label(job.paymentStatus)}` : ""}</div></div>{job.workPerformed ? <p className="mt-3 text-sm leading-6 text-zinc-300">{job.workPerformed}</p> : null}</Link>)}</div>
      </SectionCard>

      <SectionCard eyebrow="Audit trail" title="Equipment-linked workflow history" description="Status changes, return scheduling, approvals and other job events stay visible for future technicians.">
        <div className="space-y-2">{events.length === 0 ? <p className="text-sm text-zinc-500">No workflow events recorded yet.</p> : events.slice(0, 40).map((event) => <div key={event.id} className="rounded-xl border border-zinc-800 bg-black/35 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-zinc-200">{label(event.stage)}</p><p className="text-xs text-zinc-600">{when(event.createdAt)}</p></div><p className="mt-1 text-sm leading-6 text-zinc-400">{event.message}</p></div>)}</div>
      </SectionCard>
    </div>
  </AppShell>;
}
