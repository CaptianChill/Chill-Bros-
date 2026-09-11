import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DispatchPanel } from "@/components/dispatch-panel";
import { JobAssetReturnPanel } from "@/components/job-asset-return-panel";
import { LiveOfficeRefresh } from "@/components/live-office-refresh";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getEquipment } from "@/lib/chillbros/equipment-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { getActiveTechnicians, getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const [customers, technicians, jobs, equipment] = await Promise.all([getCustomers(), getActiveTechnicians(), getDispatchJobs(), getEquipment()]);
  const openJobs = jobs.filter((j) => !["paid", "completed", "cancelled"].includes(j.status));
  const unassigned = openJobs.filter((j) => !j.assignedTechId);

  return <AppShell
    title="Dispatch Command Center"
    description="See what is unassigned, what each technician is carrying, and where every service call sits in the workflow without digging through oversized forms."
    highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Live dispatch</p><StatusPill tone="emerald">{openJobs.length} open jobs</StatusPill><StatusPill tone={unassigned.length ? "amber" : "emerald"}>{unassigned.length} unassigned</StatusPill><StatusPill>{technicians.length} active technicians</StatusPill></div>}
  >
    <LiveOfficeRefresh />
    <SectionCard eyebrow="Operations" title="Dispatch board" description="Create calls fast, assign work, balance technician workload, and follow jobs from scheduling through billing.">
      <DispatchPanel customers={customers} technicians={technicians} jobs={jobs} />
    </SectionCard>
    <SectionCard eyebrow="Phase 4" title="Equipment & return visits" description="Attach the exact customer asset to the permanent job record and schedule return trips without creating duplicate work orders.">
      <JobAssetReturnPanel jobs={jobs} equipment={equipment} technicians={technicians} />
    </SectionCard>
  </AppShell>;
}
