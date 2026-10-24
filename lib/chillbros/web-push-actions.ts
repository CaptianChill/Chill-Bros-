"use server";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { sendOwnerWebPush } from "@/lib/chillbros/web-push";

const OWNER_EMAIL = "chillprostx@gmail.com";

async function requireOwner() {
  const profile = await getCurrentStaffProfile();
  return profile?.role === "manager" && profile.email.trim().toLowerCase() === OWNER_EMAIL ? profile : null;
}

type SubscriptionJson = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function savePushSubscriptionAction(subscription: SubscriptionJson, userAgent: string) {
  const owner = await requireOwner();
  if (!owner) return { ok: false as const, error: "Only the owner account gets these alerts." };
  const endpoint = String(subscription?.endpoint ?? "");
  const p256dh = String(subscription?.keys?.p256dh ?? "");
  const auth = String(subscription?.keys?.auth ?? "");
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return { ok: false as const, error: "Your phone didn't return a valid subscription." };
  const { error } = await createServiceRoleClient()
    .from("chillbros_push_subscriptions")
    .upsert({ endpoint, p256dh, auth, owner_email: OWNER_EMAIL, user_agent: userAgent.slice(0, 300), last_error: null }, { onConflict: "endpoint" });
  if (error) return { ok: false as const, error: "Couldn't save this phone. Try again." };
  return { ok: true as const };
}

export async function removePushSubscriptionAction(endpoint: string) {
  const owner = await requireOwner();
  if (!owner) return { ok: false as const };
  await createServiceRoleClient().from("chillbros_push_subscriptions").delete().eq("endpoint", String(endpoint));
  return { ok: true as const };
}

export async function sendTestPushAction() {
  const owner = await requireOwner();
  if (!owner) return { ok: false as const, sent: 0 };
  const result = await sendOwnerWebPush({ title: "Chill Pros alerts are on", message: "New calls, bookings, payments and leads will show up like this.", path: "/", tags: ["green_circle"] });
  return { ok: result.sent > 0, sent: result.sent };
}
