"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createCustomerAction } from "@/lib/chillbros/operations";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createScheduleCustomerAction(formData: FormData): Promise<never> {
  const week = text(formData, "week");
  const result = await createCustomerAction({
    name: text(formData, "name"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    address: text(formData, "address"),
  });

  const query = new URLSearchParams({ t: Date.now().toString() });
  if (week) query.set("week", week);

  if (!result.ok) {
    query.set("error", result.error);
    redirect(`/schedule?${query.toString()}`);
  }

  revalidatePath("/schedule");
  revalidatePath("/customers");
  revalidatePath("/dispatch");
  query.set("success", "Customer added. They are now available in the schedule customer list.");
  query.set("customer", result.data.customerId);
  redirect(`/schedule?${query.toString()}`);
}
