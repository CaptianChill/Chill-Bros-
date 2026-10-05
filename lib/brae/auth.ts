import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Read-only API access for the owner's local assistant (Brae.I.).
 *
 * Every /api/brae/* route calls this first. Access requires
 * `Authorization: Bearer <BRAE_API_KEY>`. If BRAE_API_KEY is not set in the
 * environment, every request is refused — the integration is off by default.
 */
export function rejectUnlessBrae(request: Request): Response | null {
  const key = String(process.env.BRAE_API_KEY || "").trim();
  if (key.length < 32) {
    return Response.json({ ok: false, error: "Brae.I. access is not configured." }, { status: 503 });
  }
  const header = request.headers.get("authorization") || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(key);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export const noStore = { headers: { "Cache-Control": "no-store" } };
