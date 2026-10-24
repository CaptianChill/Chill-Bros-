"use server";

import { revalidatePath } from "next/cache";

import { getOwnerProfile } from "@/lib/chillbros/sent-invoice-history";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

/** Owner sets an employee's cell number for work texts. Empty clears it. */
export async function setStaffPhoneAction(staffId: string, phone: string): Promise<{ ok: true; phone: string | null } | { ok: false; error: string }> {
  if (!(await getOwnerProfile())) return { ok: false, error: "Only the owner can change employee phone numbers." };
  const raw = String(phone ?? "").trim();
  let value: string | null = null;
  if (raw) {
    const digits = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
    if (digits.length !== 10) return { ok: false, error: "Enter a 10-digit US cell number." };
    value = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  const { error } = await createServiceRoleClient().from("chillbros_profiles").update({ phone: value }).eq("id", staffId);
  if (error) return { ok: false, error: "Could not save the number." };
  revalidatePath("/owner");
  return { ok: true, phone: value };
}
