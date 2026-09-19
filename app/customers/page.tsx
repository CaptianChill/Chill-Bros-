import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CustomerCenterCompact } from "@/components/customer-center-compact";
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

  return <AppShell title="Customers">
    <CustomerCenterCompact customers={customers} technicians={technicians} equipment={equipment} jobs={jobs} />
  </AppShell>;
}
