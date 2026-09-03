import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { InventoryAdmin } from "@/components/inventory-admin";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getFeeSettings, getPartsCatalog } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");
  const [partsCatalog, feeSettings] = await Promise.all([getPartsCatalog(), getFeeSettings()]);
  const lowStock = partsCatalog.filter((part) => part.stock < 5).length;
  return (
    <AppShell
      title="Manage the live parts catalog, stock, cost, retail pricing, and baseline service fees."
      description="Inventory is now an actual manager workspace rather than a read-only display. Changes feed technician part selection and estimate suggestions immediately."
      highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Inventory state</p><p className="text-3xl font-semibold text-white">{partsCatalog.length} parts</p><StatusPill tone={lowStock > 0 ? "amber" : "emerald"}>{lowStock} low stock</StatusPill><StatusPill>{feeSettings.length} fee presets</StatusPill></div>}
    >
      <SectionCard eyebrow="Manager price book" title="Parts, stock & service fees" description="Search, add, edit, and safely retire inventory while keeping cost and retail pricing centralized.">
        <InventoryAdmin parts={partsCatalog} fees={feeSettings} />
      </SectionCard>
    </AppShell>
  );
}
