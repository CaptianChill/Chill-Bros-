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
  return <AppShell title="Equipment Database" description="Save customer equipment once, then reuse the record for service history, field knowledge, parts, and future diagnostics." highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Field asset database</p><StatusPill tone="emerald">{equipment.length} equipment records</StatusPill><StatusPill>{customers.length} customers</StatusPill></div>}><SectionCard eyebrow="Customer assets" title="Equipment registry" description="Add or update equipment from the field. Deleting linked history remains manager-only."><EquipmentAdmin customers={customers} equipment={equipment} canDelete={profile.role === "manager"} /></SectionCard></AppShell>;
}
