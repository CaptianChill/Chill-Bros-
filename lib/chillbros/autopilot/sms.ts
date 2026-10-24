import "server-only";

import { normalizeContact } from "./links";

// Text messages go only to people who contacted us or are existing customers,
// never to cold prospects. Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.
export async function sendAutopilotSms(to: string, body: string): Promise<{ status: "sent" | "failed" | "configuration_required"; error?: string }> {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  const from = String(process.env.TWILIO_FROM_NUMBER || "").trim();
  if (!sid || !token || !from) return { status: "configuration_required", error: "Twilio is not connected." };
  const number = normalizeContact(to);
  if (!/^\+1\d{10}$/.test(number)) return { status: "failed", error: "Phone number is not a valid US mobile number." };
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: number, From: from, Body: body.slice(0, 640) }).toString(),
      cache: "no-store",
    });
    return response.ok ? { status: "sent" } : { status: "failed", error: `Twilio returned HTTP ${response.status}.` };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "SMS send failed." };
  }
}
