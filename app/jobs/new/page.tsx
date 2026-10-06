import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { NewServiceCallForm } from "@/components/new-service-call-form";
import { getEquipment } from "@/lib/chillbros/equipment-queries";
import { getActiveTechnicians } from "@/lib/chillbros/operations-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { ctToday } from "@/lib/chillbros/schedule-window";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
// Prefill from other screens: ?customer=<id>, ?equipment=<id> (also picks that
// unit's customer), ?tech=<id>, ?date=YYYY-MM-DD, and ?from=schedule to go
// back to the calendar after saving.
type Props = { searchParams: Promise<{ customer?: string; equipment?: string; tech?: string; date?: string; from?: string }> };

export default async function NewServiceCallPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");

  const [customers, equipment, technicians, params] = await Promise.all([getCustomers(), getEquipment(1000), getActiveTechnicians(), searchParams]);
  const customerOptions = customers
    .filter((customer) => customer.name !== "Chill Pros Team")
    .map((customer) => ({ id: customer.id, name: customer.name, address: customer.address ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const units = equipment.map((unit) => ({
    id: unit.id,
    customerId: unit.customerId,
    label: [[unit.manufacturer, unit.model].filter(Boolean).join(" ") || unit.equipmentType, unit.serialNumber ? `S/N ${unit.serialNumber}` : null, unit.assetTag].filter(Boolean).join(" · "),
  }));

  const techOptions = technicians.map((tech) => ({ id: tech.id, fullName: tech.fullName }));
  const prefillUnit = units.find((unit) => unit.id === params.equipment);
  const prefillCustomer = prefillUnit?.customerId ?? params.customer;
  const initialCustomerId = customerOptions.some((c) => c.id === prefillCustomer) ? prefillCustomer : undefined;
  const initialEquipmentId = prefillUnit && prefillUnit.customerId === initialCustomerId ? prefillUnit.id : undefined;
  const initialTechId = techOptions.some((tech) => tech.id === params.tech) ? params.tech : undefined;
  const initialDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : undefined;

  return (
    <AppShell title="New service call" description="Create the call, schedule the tech, then add parts.">
      <NewServiceCallForm
        customers={customerOptions}
        units={units}
        technicians={techOptions}
        today={ctToday()}
        initialCustomerId={initialCustomerId}
        initialEquipmentId={initialEquipmentId}
        initialTechId={initialTechId}
        initialDate={initialDate}
        returnTo={params.from === "schedule" ? "schedule" : undefined}
      />
    </AppShell>
  );
}
