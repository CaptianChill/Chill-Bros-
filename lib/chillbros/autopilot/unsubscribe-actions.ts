"use server";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

import { normalizeContact, verifyUnsubscribe } from "./links";
import { suppress } from "./store";

export async function unsubscribeAction(contact: string, signature: string): Promise<{ ok: boolean }> {
  if (!verifyUnsubscribe(contact, signature)) return { ok: false };
  const s = createServiceRoleClient();
  const c = normalizeContact(contact);
  await suppress(s, c, "unsubscribed");
  if (c.includes("@")) {
    await s.from("chillbros_revenue_prospects").update({ do_not_contact: true, do_not_contact_reason: "Unsubscribed from email", outreach_done: true }).ilike("contact_email", c);
    await s.from("chillbros_inbound_leads").update({ status: "suppressed" }).ilike("email", c).in("status", ["new", "contacted"]);
  }
  return { ok: true };
}
