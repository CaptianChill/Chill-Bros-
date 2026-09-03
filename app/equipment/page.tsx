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
  if (!profile || profile.role !== "manager") redirect("/");
  const [customers, equipment] = await Promise.all([getCustomers(), getEquipment()]);
  return <AppShell title="Track customer HVAC/R and commercial kitchen equipment by model, serial, refrigerant, and service notes." description="The equipment registry ties asset details to the customer so field technicians can see what they are walking into before touching a panel." highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Asset registry</p><StatusPill tone="emerald">{equipment.length} equipment records</StatusPill><StatusPill>{customers.length} customers</StatusPill></div>}><SectionCard eyebrow="Customer assets" title="Equipment registry" description="Create and maintain equipment records used for service history and field reference."><EquipmentAdmin customers={customers} equipment={equipment} /></SectionCard></AppShell>;
}
