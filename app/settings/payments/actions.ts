"use server";

import { redirect } from "next/navigation";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";
import { updatePaymentSettings } from "@/lib/chillbros/payment-settings";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function updateManualPaymentSettingsAction(formData: FormData): Promise<never> {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/settings/payments?error=Manager+access+required.");
  const input = {
    zelleContact: text(formData, "zelleContact"),
    venmoHandle: text(formData, "venmoHandle"),
    chimeHandle: text(formData, "chimeHandle"),
    checkPayableTo: text(formData, "checkPayableTo"),
    checkMailingAddress: text(formData, "checkMailingAddress"),
  };
  if (input.zelleContact.length > 200 || input.venmoHandle.length > 200 || input.chimeHandle.length > 200 || input.checkPayableTo.length > 200) redirect("/settings/payments?error=One+of+those+fields+is+too+long.");
  if (input.checkMailingAddress.length > 500) redirect("/settings/payments?error=Mailing+address+is+too+long.");
  const result = await updatePaymentSettings(input, profile.id);
  if (!result.ok) redirect(`/settings/payments?error=${encodeURIComponent(result.error)}`);
  redirect("/settings/payments?success=Payment+options+saved.+Customers+will+see+the+updated+tabs+on+their+next+invoice+view.");
}


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
