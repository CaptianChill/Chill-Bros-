import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CustomerCenter } from "@/components/customer-center";
import { StatusPill } from "@/components/status-pill";
import { getEquipment } from "@/lib/chillbros/equipment-queries";
import { getActiveTechnicians, getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");

  const [customers, technicians, equipment, jobs] = await Promise.all([
    getCustomers(),
    getActiveTechnicians(),
    getEquipment(1000),
    getDispatchJobs(500),
  ]);

  const openCalls = jobs.filter((job) => ["scheduled", "in_progress"].includes(job.status)).length;

  return <AppShell
    title="Customer Center"
    description="Customer intake, technician assignment, searchable customer records, equipment assets, and complete service history in one office workspace."
    highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Customer database</p><StatusPill tone="emerald">{customers.length} customers</StatusPill><StatusPill>{equipment.length} equipment assets</StatusPill><StatusPill tone={openCalls > 0 ? "amber" : "emerald"}>{openCalls} open calls</StatusPill></div>}
  >
    <CustomerCenter customers={customers} technicians={technicians} equipment={equipment} jobs={jobs} />
  </AppShell>;
}
