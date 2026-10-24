import { timingSafeEqual } from "node:crypto";

import { sendOwnerWebPush } from "@/lib/chillbros/web-push";

export const dynamic = "force-dynamic";

// Called by the database's chillbros_push() (pg_net) for every owner alert, so the
// owner's phone gets an app notification with the Chill Pros icon. Guarded by
// NOTIFY_WEBHOOK_SECRET (same secret as /api/notify/new-job).
function authorized(request: Request) {
  const secret = String(process.env.NOTIFY_WEBHOOK_SECRET || "").trim();
  if (!secret) return false;
  const given = Buffer.from(String(request.headers.get("authorization") || ""));
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { title?: unknown; message?: unknown; path?: unknown; priority?: unknown; tags?: unknown };
  const title = String(body.title ?? "").trim();
  if (!title) return Response.json({ ok: false, error: "title required" }, { status: 400 });
  const result = await sendOwnerWebPush({
    title,
    message: String(body.message ?? ""),
    path: typeof body.path === "string" ? body.path : null,
    priority: Number(body.priority) || 3,
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
  });
  return Response.json({ ok: true, ...result });
}
