import "server-only";

import webpush from "web-push";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

// Owner phone alerts as real app notifications, so they show the Chill Pros
// home-screen icon instead of the ntfy icon. ntfy keeps running as a backup.
// Every alert reaches this through the database's chillbros_push() ->
// POST /api/notify/push, so triggers and app code are both covered.

const DOTS: Record<string, string> = {
  red_circle: "🔴",
  orange_circle: "🟠",
  green_circle: "🟢",
  large_blue_circle: "🔵",
  white_circle: "⚪",
};

export type WebPushInput = { title: string; message: string; path?: string | null; priority?: number; tags?: string[] };

function configured() {
  const publicKey = String(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails("mailto:chillprostx@gmail.com", publicKey, privateKey);
  return true;
}

export async function sendOwnerWebPush(input: WebPushInput): Promise<{ sent: number; failed: number }> {
  if (!configured()) return { sent: 0, failed: 0 };
  const db = createServiceRoleClient();
  const { data: subs } = await db.from("chillbros_push_subscriptions").select("id,endpoint,p256dh,auth");
  if (!subs?.length) return { sent: 0, failed: 0 };

  const dot = (input.tags ?? []).map((tag) => DOTS[tag]).find(Boolean);
  const payload = JSON.stringify({
    title: `${dot ? `${dot} ` : ""}${input.title}`.slice(0, 120),
    body: input.message.replace(/\s+/g, " ").trim().slice(0, 240),
    url: input.path && input.path.startsWith("/") ? input.path : "/",
    urgent: (input.priority ?? 3) >= 5,
  });
  const urgency = (input.priority ?? 3) >= 4 ? "high" : (input.priority ?? 3) <= 2 ? "low" : "normal";

  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 60 * 60 * 24, urgency });
        sent += 1;
        await db.from("chillbros_push_subscriptions").update({ last_success_at: new Date().toISOString(), last_error: null }).eq("id", sub.id);
      } catch (error) {
        failed += 1;
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Phone unsubscribed or app removed from home screen: drop it.
          await db.from("chillbros_push_subscriptions").delete().eq("id", sub.id);
        } else {
          const message = error instanceof Error ? error.message : String(error);
          console.error("[web-push] send failed", status, message);
          await db.from("chillbros_push_subscriptions").update({ last_error: `${status ?? ""} ${message}`.trim().slice(0, 300) }).eq("id", sub.id);
        }
      }
    }),
  );
  return { sent, failed };
}
