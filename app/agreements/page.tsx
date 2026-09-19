import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { ServiceAgreementAdmin } from "@/components/service-agreement-admin";
import { StatusPill } from "@/components/status-pill";
import { getCustomers } from "@/lib/chillbros/queries";
import { getServiceAgreements } from "@/lib/chillbros/service-agreement-queries";
import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";

export const dynamic = "force-dynamic";

export default async function AgreementsPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const [customers, agreements] = await Promise.all([getCustomers(), getServiceAgreements()]);
  const active = agreements.filter((a) => a.status === "active").length;
  const awaiting = agreements.filter((a) => a.status === "proposed").length;
  return <AppShell
    title="Build completely custom monthly service plans around the customer’s hours, schedule, scope, and budget."
    description="Create the plan on site or from the office, calculate monthly pricing, save it under the customer, and send a secure printable quote/agreement for review and acceptance."
    highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Plan agreements</p><StatusPill tone="emerald">{active} active</StatusPill><StatusPill tone="amber">{awaiting} awaiting approval</StatusPill><StatusPill>{agreements.length} total</StatusPill></div>}
  >
    <SectionCard eyebrow="Monthly plans" title="Custom service agreement builder" description="Visits, hours, rates, preferred days, services, discounts, setup fees, dates, terms, and customer preferences all stay editable until the customer accepts.">
      <ServiceAgreementAdmin customers={customers} agreements={agreements} />
    </SectionCard>
  </AppShell>;
}
