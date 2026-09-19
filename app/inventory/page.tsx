import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { InventoryAdmin } from "@/components/inventory-admin";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getFeeSettings, getPartsCatalog, getPriceBookEntries } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");
  const [partsCatalog, feeSettings, priceBook] = await Promise.all([getPartsCatalog(), getFeeSettings(), getPriceBookEntries()]);
  const lowStock = partsCatalog.filter((part) => part.stock < 5).length;
  return (
    <AppShell
      title="Manage the live parts catalog, stock, cost, retail pricing, and master service price book."
      description="Inventory and the manager price book are editable in one workspace. Changes feed the live parts database while price-book items stay separated from truck stock."
      highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Inventory state</p><p className="text-3xl font-semibold text-white">{partsCatalog.length} parts</p><StatusPill tone={lowStock > 0 ? "amber" : "emerald"}>{lowStock} low stock</StatusPill><StatusPill>{priceBook.length} price-book items</StatusPill><StatusPill>{feeSettings.length} fee presets</StatusPill></div>}
    >
      <SectionCard eyebrow="Manager price book" title="Parts, pricing & service fees" description="Search and edit stock, then use the category and item selectors below the parts list to adjust Chill Bros sell prices and descriptions.">
        <InventoryAdmin parts={partsCatalog} fees={feeSettings} priceBook={priceBook} />
      </SectionCard>
    </AppShell>
  );
}
