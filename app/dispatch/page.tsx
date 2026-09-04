import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DispatchPanel } from "@/components/dispatch-panel";
import { LiveOfficeRefresh } from "@/components/live-office-refresh";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getCustomers } from "@/lib/chillbros/queries";
import { getActiveTechnicians, getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");
  const [customers, technicians, jobs] = await Promise.all([getCustomers(), getActiveTechnicians(), getDispatchJobs()]);
  return <AppShell title="Create customers, dispatch jobs, assign technicians, and manage every active service call." description="Existing service-call fields autosave, technician/customer workflow state is visible here, and the board refreshes live while idle." highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Dispatch state</p><StatusPill tone="emerald">{jobs.filter((j) => !["completed", "cancelled"].includes(j.status)).length} open jobs</StatusPill><StatusPill>{technicians.length} active technicians</StatusPill><StatusPill>{customers.length} customers</StatusPill></div>}>
    <LiveOfficeRefresh />
    <SectionCard eyebrow="Office workflow" title="Customer intake + dispatch" description="Create the customer, assign the service call, then track technician → approval → invoice status from this board."><DispatchPanel customers={customers} technicians={technicians} jobs={jobs} /></SectionCard>
  </AppShell>;
}
