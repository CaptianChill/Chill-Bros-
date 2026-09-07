"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

function text(fd: FormData, key: string, max = 500) { return String(fd.get(key) ?? "").trim().slice(0, max); }

export async function savePaymentSettingsAction(formData: FormData): Promise<never> {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/sign-in");
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("chillbros_payment_settings").upsert({
    id: "default",
    stripe_enabled: formData.get("stripeEnabled") === "on",
    zelle_contact: text(formData, "zelleContact", 200) || null,
    cash_app_handle: text(formData, "cashAppHandle", 120) || null,
    venmo_handle: text(formData, "venmoHandle", 120) || null,
    check_payable_to: text(formData, "checkPayableTo", 200) || null,
    manual_ach_instructions: text(formData, "manualAchInstructions", 1000) || null,
    customer_payment_note: text(formData, "customerPaymentNote", 1000) || null,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) redirect(`/settings/payments?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/settings/payments");
  revalidatePath("/portal/[token]", "page");
  redirect("/settings/payments?success=Payment+settings+saved.");
}
