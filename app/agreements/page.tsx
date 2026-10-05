import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { ServiceAgreementAdmin } from "@/components/service-agreement-admin";
import { StatusPill } from "@/components/status-pill";
import { getCustomers } from "@/lib/chillbros/queries";
import { getServiceAgreements } from "@/lib/chillbros/service-agreement-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ customer?: string; plan?: string }> };

export default async function AgreementsPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const [{ customer, plan }, customers, agreements] = await Promise.all([searchParams, getCustomers(), getServiceAgreements()]);
  const active = agreements.filter((a) => a.status === "active").length;
  const waiting = agreements.filter((a) => ["draft", "proposed", "accepted"].includes(a.status)).length;
  const monthly = agreements.filter((a) => a.status === "active").reduce((sum, a) => sum + a.monthlyTotal, 0);
  return <AppShell
    title="Service plans"
    description="Build a custom monthly maintenance package in under a minute: pick the customer, start from a package, set the price, and send the link."
    highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Service plans</p><StatusPill tone="emerald">{active} active · {monthly.toLocaleString("en-US", { style: "currency", currency: "USD" })}/mo</StatusPill><StatusPill tone="amber">{waiting} open</StatusPill></div>}
  >
    <SectionCard eyebrow="Monthly packages" title="New service plan" description="Everything stays editable until the customer approves.">
      <ServiceAgreementAdmin customers={customers} agreements={agreements} initialCustomerId={customer} focusPlanId={plan} />
    </SectionCard>
  </AppShell>;
}
