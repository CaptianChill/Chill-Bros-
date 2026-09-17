"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";

function text(fd: FormData, key: string, max = 500) { return String(fd.get(key) ?? "").trim().slice(0, max); }

export async function sendTestEmailAction(): Promise<never> {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/settings/payments?error=Manager+access+required.");
  let failure: string | null = null;
  const missing = ["GMAIL_SMTP_USER", "GMAIL_SMTP_APP_PASSWORD", "COMPANY_MAIN_EMAIL"].filter((name) => !process.env[name]?.trim());
  if (missing.length) failure = `Missing environment variable(s): ${missing.join(", ")}`;
  else {
    try {
      const result = await sendCompanyEmail(profile.email, "Chill Bros test email", "Your Chill Bros company email sender is working.");
      if (!result.sent) failure = result.error;
    } catch (error) { failure = error instanceof Error ? error.message : "Test email failed."; }
  }
  try {
    const { error } = await createServiceRoleClient().from("chillbros_email_log").insert({ subject: "Chill Bros test email", recipients: profile.email, status: failure ? "failed" : "sent" });
    if (error) console.error("[test-email] log insert failed", error);
  } catch (error) { console.error("[test-email] log insert failed", error); }
  const query = new URLSearchParams(failure ? { error: failure } : { success: `Test email sent to ${profile.email}.` });
  redirect(`/settings/payments?${query}`);
}

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
