import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { getEquipmentByCustomer, type EquipmentRecord } from "./equipment-queries";
import { getServiceAgreementsByCustomer, type ServiceAgreement } from "./service-agreement-queries";
import type { Customer, JobStatus } from "./types";

export type CustomerProfileJob = {
  id: string;
  status: JobStatus;
  assignedTechName: string | null;
  location: string | null;
  scheduledWindow: string | null;
  scope: string | null;
  workPerformed: string | null;
  createdAt: string;
  archivedAt: string | null;
};

export type CustomerProfileData = {
  customer: Customer;
  equipment: EquipmentRecord[];
  jobs: CustomerProfileJob[];
  agreements: ServiceAgreement[];
};

export async function getCustomerProfile(customerId: string): Promise<CustomerProfileData | null> {
  const supabase = createServiceRoleClient();
  const { data: customer, error } = await supabase.from("chillbros_customers").select("id,name,address,phone,email").eq("id", customerId).maybeSingle();
  if (error || !customer) return null;

  const [{ data: history }, { data: jobs }, equipment, agreements] = await Promise.all([
    supabase.from("chillbros_customer_service_history").select("note,occurred_on").eq("customer_id", customerId).order("occurred_on", { ascending: false }).limit(100),
    supabase.from("chillbros_jobs").select("id,status,location,scheduled_window,scope,work_performed,created_at,archived_at,tech:chillbros_profiles(full_name)").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(100),
    getEquipmentByCustomer(customerId),
    getServiceAgreementsByCustomer(customerId),
  ]);

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      address: customer.address,
      phone: customer.phone,
      email: customer.email,
      history: (history ?? []).map((entry) => `${new Date(entry.occurred_on).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • ${entry.note}`),
    },
    equipment,
    agreements,
    jobs: (jobs ?? []).map((row) => {
      const tech = Array.isArray(row.tech) ? row.tech[0] : row.tech;
      return {
        id: row.id,
        status: row.status,
        assignedTechName: tech?.full_name ?? null,
        location: row.location,
        scheduledWindow: row.scheduled_window,
        scope: row.scope,
        workPerformed: row.work_performed,
        createdAt: row.created_at,
        archivedAt: row.archived_at,
      };
    }),
  };
}
