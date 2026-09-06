"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { addStaffAccountAction } from "@/lib/chillbros/mutations";
import { createCustomerAction, createJobAction } from "@/lib/chillbros/operations";
import type { StaffRole } from "@/lib/chillbros/types";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function go(mode: string, params: Record<string, string | undefined> = {}): never {
  const search = new URLSearchParams({ mode });
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  redirect(`/create?${search.toString()}`);
}

export async function createCustomerFromCenter(formData: FormData): Promise<never> {
  const result = await createCustomerAction({
    name: text(formData, "name"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    address: text(formData, "address"),
  });
  if (!result.ok) go("customer", { error: result.error });
  go("job", { customer: result.data.customerId, success: "Customer created. Create the service call below." });
}

export async function createJobFromCenter(formData: FormData): Promise<never> {
  const result = await createJobAction({
    customerId: text(formData, "customerId"),
    assignedTechId: text(formData, "assignedTechId") || null,
    location: text(formData, "location"),
    scheduledWindow: text(formData, "scheduledWindow"),
    scope: text(formData, "scope"),
  });
  if (!result.ok) go("job", { error: result.error, customer: text(formData, "customerId") });
  go("estimate", { job: result.data.jobId, success: "Service call created. Build the estimate now or return to it later." });
}

export async function createStaffFromCenter(formData: FormData): Promise<never> {
  const role = text(formData, "role") as StaffRole;
  const email = text(formData, "email");
  const result = await addStaffAccountAction({
    fullName: text(formData, "name"),
    email,
    role,
  });
  if (!result.ok) go("technician", { error: result.error });

  const store = await cookies();
  store.set("chillbros_creation_temp", JSON.stringify({ email, password: result.data.tempPassword }), {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: "/create",
    maxAge: 300,
  });
  go("technician", { success: "Staff account created. Copy the temporary password shown below." });
}

export async function clearCreationTempPassword(): Promise<never> {
  const store = await cookies();
  store.set("chillbros_creation_temp", "", { httpOnly: true, sameSite: "strict", secure: true, path: "/create", maxAge: 0 });
  go("technician");
}
