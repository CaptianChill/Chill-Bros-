"use server";

import { createHash, randomBytes } from "node:crypto";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { normalizeEmail } from "@/lib/chillbros/customer-account";
import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";

type Result = { ok: true; url: string; emailed: boolean; notice: string } | { ok: false; error: string };

export async function createCustomerInviteAction(customerId: string, sendEmail: boolean): Promise<Result> {
  const staff = await getCurrentStaffProfile();
  if (!staff || !["manager", "office"].includes(staff.role)) return { ok: false, error: "Office or manager access required." };
  const db = createServiceRoleClient();
  const { data: customer, error: readError } = await db.from("chillbros_customers").select("id,name,email").eq("id", customerId).maybeSingle();
  if (readError || !customer) return { ok: false, error: "Customer could not be loaded." };
  const email = normalizeEmail(customer.email);
  if (sendEmail && !email) return { ok: false, error: "Save a valid customer email first, or create a link to share." };
  const token = randomBytes(32).toString("base64url");
  const { error } = await db.from("chillbros_customer_invites").insert({ customer_id: customer.id, token_hash: createHash("sha256").update(token).digest("hex") });
  if (error) return { ok: false, error: "The invitation could not be created. Try again." };
  const base = String(process.env.NEXT_PUBLIC_APP_URL || "https://chill-bros.vercel.app").trim().replace(/\/$/, "");
  const url = `${base}/my/sign-in?invite=${encodeURIComponent(token)}`;
  if (!sendEmail) return { ok: true, url, emailed: false, notice: "Invitation created. Share this private link with the customer. It expires in 90 days." };
  const text = `Hello ${customer.name},\n\nYour Chill Pros customer portal is ready:\n${url}\n\nVerify your email once to view equipment and service history, monthly programs, request service, approve quotes, and pay invoices. This browser remembers your sign-in for 60 days.\n\nThis private invitation expires in 90 days. Share it only with people authorized to manage your business account.\n\nChill Pros`;
  const sent = await sendCompanyEmail(email!, "Your Chill Pros customer portal invitation", text).catch(() => ({ status: "failed" as const }));
  return { ok: true, url, emailed: sent.status === "sent", notice: sent.status === "sent" ? `Invitation emailed to ${email}.` : "Invitation created, but the email could not be sent. Copy the link to share it or try again." };
}
