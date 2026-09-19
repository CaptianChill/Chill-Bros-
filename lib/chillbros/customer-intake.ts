"use server";

import { revalidatePath } from "next/cache";

import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";
import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type CustomerIntakeInput = {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  intakeNotes?: string;
  createServiceCall: boolean;
  assignedTechId?: string | null;
  location?: string;
  scope?: string;
  scheduledWindow?: string;
};

function cleanText(value: string | null | undefined, max: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

function refreshCustomerCenter(customerId?: string) {
  for (const path of ["/customers", "/crm", "/dispatch", "/office", "/technician", "/"]) revalidatePath(path);
  if (customerId) revalidatePath(`/customers/${customerId}`);
}

export async function createCustomerIntakeAction(input: CustomerIntakeInput): Promise<Result<{ customerId: string; jobId: string | null }>> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Sign in again to continue." };
  if (!["manager", "office"].includes(profile.role)) return { ok: false, error: "Office or manager access required." };

  const name = String(input.name ?? "").trim();
  const email = cleanText(input.email, 320)?.toLowerCase() ?? null;
  const address = cleanText(input.address, 500);
  const phone = cleanText(input.phone, 50);
  const intakeNotes = cleanText(input.intakeNotes, 4000);
  const location = cleanText(input.location, 500) ?? address;
  const scope = cleanText(input.scope, 4000);
  const scheduledWindow = cleanText(input.scheduledWindow, 200);
  const assignedTechId = cleanText(input.assignedTechId, 80);

  if (!name || name.length > 200) return { ok: false, error: "Customer / business name is required and must be 200 characters or fewer." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid customer email address." };

  const supabase = createServiceRoleClient();

  if (input.createServiceCall && assignedTechId) {
    const { data: tech, error: techError } = await supabase
      .from("chillbros_profiles")
      .select("id")
      .eq("id", assignedTechId)
      .eq("role", "technician")
      .eq("status", "active")
      .maybeSingle();
    if (techError || !tech) return { ok: false, error: "Choose an active technician or leave the assignment unassigned." };
  }

  const { data: customer, error: customerError } = await supabase
    .from("chillbros_customers")
    .insert({ name, address, phone, email, created_by: profile.id })
    .select("id")
    .single();

  if (customerError || !customer) return { ok: false, error: customerError?.message ?? "Could not save the customer." };

  let jobId: string | null = null;

  if (input.createServiceCall) {
    const { data: job, error: jobError } = await supabase
      .from("chillbros_jobs")
      .insert({
        customer_id: customer.id,
        assigned_tech_id: assignedTechId || null,
        status: "scheduled",
        location,
        scope,
        scheduled_window: scheduledWindow,
      })
      .select("id")
      .single();

    if (jobError || !job) {
      // This customer was created by this request and has no completed business
      // history yet, so remove it rather than leave a half-finished intake record.
      await supabase.from("chillbros_customers").delete().eq("id", customer.id);
      return { ok: false, error: jobError?.message ?? "Customer could not be dispatched. Nothing was saved." };
    }
    jobId = job.id;
  }

  const notes: string[] = ["Customer intake created."];
  if (intakeNotes) notes.push(`Intake notes: ${intakeNotes}`);
  if (input.createServiceCall) {
    notes.push(`Initial service call created${scheduledWindow ? ` • ${scheduledWindow}` : ""}${assignedTechId ? " • technician assigned" : " • unassigned"}.`);
  }

  await supabase.from("chillbros_customer_service_history").insert(
    notes.map((note) => ({ customer_id: customer.id, note })),
  );

  refreshCustomerCenter(customer.id);
  return { ok: true, data: { customerId: customer.id, jobId } };
}
