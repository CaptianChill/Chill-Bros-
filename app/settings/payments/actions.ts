"use server";

import { redirect } from "next/navigation";

import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";
import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";
import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";


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
