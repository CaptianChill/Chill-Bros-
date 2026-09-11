import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { EquipmentAdmin } from "@/components/equipment-admin";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getEquipment } from "@/lib/chillbros/equipment-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office", "technician"].includes(profile.role)) redirect("/");
  const [customers, equipment] = await Promise.all([getCustomers(), getEquipment()]);
  return <AppShell title="Equipment Database" description="Save customer equipment once, then reuse the record for service history, field knowledge, parts, and future diagnostics." highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Field asset database</p><StatusPill tone="emerald">{equipment.length} equipment records</StatusPill><StatusPill>{customers.length} customers</StatusPill></div>}>
    <SectionCard eyebrow="Customer assets" title="Equipment registry" description="Add or update equipment from the field. Deleting linked history remains manager-only."><EquipmentAdmin customers={customers} equipment={equipment} canDelete={profile.role === "manager"} /></SectionCard>
    <SectionCard eyebrow="Phase 4" title="Permanent service records" description="Open an asset to see every linked service call, technician, repair, invoice and workflow event in chronological context.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{equipment.length === 0 ? <p className="text-sm text-zinc-500">No equipment records yet.</p> : equipment.map((asset) => <Link key={asset.id} href={`/equipment/${asset.id}`} className="rounded-2xl border border-[#2d7dff]/15 bg-black/40 p-4 transition hover:border-[#8ffafa]/40"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-white">{[asset.manufacturer, asset.model].filter(Boolean).join(" ") || asset.equipmentType}</p><p className="mt-1 truncate text-xs text-zinc-500">{asset.customerName} · {asset.equipmentType}</p></div>{asset.assetTag ? <span className="shrink-0 rounded-full border border-[#2d7dff]/20 px-2 py-1 text-[10px] text-[#bafcfc]">{asset.assetTag}</span> : null}</div><p className="mt-3 text-xs text-zinc-400">Serial: {asset.serialNumber ?? "not recorded"}</p><p className="mt-1 text-xs text-zinc-500">Open service history →</p></Link>)}</div>
    </SectionCard>
  </AppShell>;
}
