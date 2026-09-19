import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DispatchPanel } from "@/components/dispatch-panel";
import { DispatchIntelligence } from "@/components/dispatch-intelligence";
import { EquipmentFirstIntake } from "@/components/equipment-first-intake";
import { JobAssetReturnPanel } from "@/components/job-asset-return-panel";
import { LiveOfficeRefresh } from "@/components/live-office-refresh";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getEquipment } from "@/lib/chillbros/equipment-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { getActiveTechnicians, getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";
export const dynamic = "force-dynamic";
export default async function DispatchPage() {
 const profile=await getCurrentStaffProfile(); if(!profile||!["manager","office"].includes(profile.role)) redirect("/");
 const [customers,technicians,jobs,equipment]=await Promise.all([getCustomers(),getActiveTechnicians(),getDispatchJobs(),getEquipment()]);
 const openJobs=jobs.filter(j=>!["paid","completed","cancelled"].includes(j.status)); const unassigned=openJobs.filter(j=>!j.assignedTechId);
 return <AppShell title="Dispatch Command Center" description="See unassigned work, technician workload and lifecycle position from one operational board." highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Live dispatch</p><StatusPill tone="emerald">{openJobs.length} open jobs</StatusPill><StatusPill tone={unassigned.length?"amber":"emerald"}>{unassigned.length} unassigned</StatusPill><StatusPill>{technicians.length} active technicians</StatusPill></div>}><LiveOfficeRefresh/><SectionCard eyebrow="Phase 6 · Intelligence" title="Dispatch recommendations" description="Balance active workload and surface the next assignment decision before opening individual calls."><DispatchIntelligence jobs={jobs} technicians={technicians}/></SectionCard><SectionCard eyebrow="Equipment-linked intake" title="Create service call" description="Start with the customer and exact unit so the permanent history begins correctly."><EquipmentFirstIntake customers={customers} technicians={technicians} equipment={equipment}/></SectionCard><SectionCard eyebrow="Operations" title="Dispatch board" description="Assign work, balance technician workload, and follow jobs from scheduling through billing."><DispatchPanel customers={customers} technicians={technicians} jobs={jobs}/></SectionCard><SectionCard eyebrow="Equipment & return visits" title="Asset and return controls" description="Correct the linked asset and schedule return trips without duplicate work orders."><JobAssetReturnPanel jobs={jobs} equipment={equipment} technicians={technicians}/></SectionCard></AppShell>;
}