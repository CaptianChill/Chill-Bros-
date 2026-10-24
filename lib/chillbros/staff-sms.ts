import "server-only";

import { sendAutopilotSms } from "@/lib/chillbros/autopilot/sms";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

// Work texts to Chill Pros staff (assignments, schedule changes, new calls).
// Dormant until Twilio is connected (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
// TWILIO_FROM_NUMBER) and the employee has a cell number on their profile.
// Never throws: a text must not break the action that triggered it.

export async function textStaffMember(profileId: string, body: string) {
  try {
    const { data } = await createServiceRoleClient().from("chillbros_profiles").select("phone,status,full_name").eq("id", profileId).maybeSingle();
    if (!data?.phone || data.status !== "active") return { status: "skipped" as const };
    const result = await sendAutopilotSms(String(data.phone), body.slice(0, 600));
    if (result.status === "failed") console.error(`[staff-sms] ${data.full_name}: ${result.error}`);
    return result;
  } catch (error) {
    console.error("[staff-sms] failed", error instanceof Error ? error.message : error);
    return { status: "failed" as const };
  }
}

/** Text every active office/dispatch employee who has a cell number. */
export async function textOfficeStaff(body: string) {
  try {
    const { data } = await createServiceRoleClient().from("chillbros_profiles").select("id").eq("role", "office").eq("status", "active").not("phone", "is", null);
    await Promise.all((data ?? []).map((row) => textStaffMember(row.id, body)));
  } catch (error) {
    console.error("[staff-sms] office text failed", error instanceof Error ? error.message : error);
  }
}
