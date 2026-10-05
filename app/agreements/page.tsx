import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { ServiceAgreementAdmin } from "@/components/service-agreement-admin";
import { ServicePlanSalesProposalBuilder } from "@/components/service-plan-sales-proposal-builder";
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
    description="Build a customer-ready Silver, Gold, or Diamond service proposal, calculate a protected package price, and send the approval link from the existing Chill Pros workflow."
    highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Service plans</p><StatusPill tone="emerald">{active} active · {monthly.toLocaleString("en-US", { style: "currency", currency: "USD" })}/mo</StatusPill><StatusPill tone="amber">{waiting} open</StatusPill></div>}
  >
    <div className="space-y-5">
      <SectionCard eyebrow="Sales proposal" title="Package Plan Customizer" description="Customer is preselected when you open this from their record. Start at $80/hour, include scheduled trips, price parts internally at 2× company cost, protect the package with a reserve and target margin, then create the live customer proposal.">
        <ServicePlanSalesProposalBuilder customers={customers} initialCustomerId={customer} />
      </SectionCard>

      <SectionCard eyebrow="Monthly packages" title="Saved plans & advanced editor" description="Manage existing service plans, customer approval, text/email links, printable documents, scheduling, and custom terms.">
        <ServiceAgreementAdmin customers={customers} agreements={agreements} initialCustomerId={customer} focusPlanId={plan} />
      </SectionCard>
    </div>
  </AppShell>;
}
