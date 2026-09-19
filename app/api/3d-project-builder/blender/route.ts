import { getVercelOidcToken } from "@vercel/functions/oidc";
import { NextResponse } from "next/server";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_RENDER_WORKER_URL = "https://chill-bros-blender-renderer-v2.onrender.com";

function workerBase() {
  return (process.env.BLENDER_RENDER_URL || DEFAULT_RENDER_WORKER_URL).trim().replace(/\/$/, "");
}

async function workerAuthorization() {
  const configured = (process.env.BLENDER_RENDER_TOKEN || "").trim();
  if (configured) return configured;
  return (await getVercelOidcToken()).trim();
}

function cleanText(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function warmWorker(base: string) {
  try {
    const response = await fetch(`${base}/health`, { cache: "no-store", signal: AbortSignal.timeout(75_000) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") {
    return NextResponse.json({ error: "Manager access required." }, { status: 401 });
  }

  const base = workerBase();
  if (!base) return NextResponse.json({ configured: false, engine: "blender-cycles" });

  try {
    const response = await fetch(`${base}/health`, { cache: "no-store", signal: AbortSignal.timeout(75_000) });
    const health = await response.json().catch(() => ({}));
    return NextResponse.json({
      configured: true,
      online: response.ok && health?.ok !== false,
      engine: "blender-cycles",
      status: response.status,
      version: typeof health?.version === "string" ? health.version : undefined,
      authentication: health?.auth || "render-worker",
    });
  } catch (error) {
    console.error("Blender worker health check failed", error);
    return NextResponse.json({ configured: true, online: false, engine: "blender-cycles" });
  }
}

export async function POST(request: Request) {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") {
    return NextResponse.json({ error: "Manager access required." }, { status: 401 });
  }

  const base = workerBase();
  let authorization = "";
  try { authorization = await workerAuthorization(); } catch (error) { console.error("Unable to obtain Blender worker identity", error); }

  if (!base) return NextResponse.json({ error: "Blender render worker is not connected yet.", setupRequired: true, engine: "blender-cycles" }, { status: 503 });
  if (!authorization) return NextResponse.json({ error: "The Blender worker connection could not obtain a server identity token.", engine: "blender-cycles" }, { status: 503 });

  const incoming = await request.json().catch(() => null);
  if (!incoming || !Array.isArray(incoming.rooms) || incoming.rooms.length < 1) {
    return NextResponse.json({ error: "Save at least one measured room before rendering." }, { status: 400 });
  }

  const rooms = incoming.rooms.slice(0, 24).map((room: Record<string, unknown>, index: number) => ({
    id: cleanText(room?.id, 120) || `room-${index + 1}`,
    name: cleanText(room?.name, 120) || `Room ${index + 1}`,
    width: Math.min(200, Math.max(1, Number(room?.width) || 12)),
    depth: Math.min(200, Math.max(1, Number(room?.depth) || 12)),
    height: Math.min(50, Math.max(1, Number(room?.height) || 8)),
    verified: Boolean(room?.verified),
  }));

  const brief = incoming.brief && typeof incoming.brief === "object" ? {
    customer: cleanText(incoming.brief.customer, 300),
    address: cleanText(incoming.brief.address, 500),
    projectTitle: cleanText(incoming.brief.projectTitle, 300),
    requestedChanges: cleanText(incoming.brief.requestedChanges, 3000),
    finishedProduct: cleanText(incoming.brief.finishedProduct, 3000),
    fieldNotes: cleanText(incoming.brief.fieldNotes, 3000),
  } : undefined;

  const payload = {
    projectName: cleanText(incoming.projectName, 300) || "Chill Bros Project",
    notes: cleanText(incoming.notes, 3000),
    rooms,
    brief,
    environment: cleanText(incoming.environment, 200) || "clean studio",
    presentation: cleanText(incoming.presentation, 200) || "wide customer presentation",
    samples: Math.min(32, Math.max(20, Number(incoming.samples) || 24)),
    width: 1280,
    height: 854,
  };

  await warmWorker(base);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 255_000);

  try {
    const response = await fetch(`${base}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authorization}` },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Blender worker render failed", response.status, detail.slice(0, 2000));
      return NextResponse.json({ error: "Blender render failed on the render worker.", detail: detail.slice(0, 1200), engine: "blender-cycles" }, { status: 502 });
    }

    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) return NextResponse.json({ error: "Blender returned an empty render." }, { status: 502 });
    if (bytes.byteLength > 25 * 1024 * 1024) return NextResponse.json({ error: "Blender render was unexpectedly large." }, { status: 502 });

    return new NextResponse(bytes, {
      status: 200,
      headers: { "Content-Type": response.headers.get("content-type") || "image/png", "Cache-Control": "no-store", "X-Chillbros-Render-Engine": "blender-cycles" },
    });
  } catch (error) {
    console.error("Blender render proxy failed", error);
    const timedOut = error instanceof Error && error.name === "AbortError";
    return NextResponse.json({ error: timedOut ? "Blender render timed out." : "Unable to reach the Blender render worker." }, { status: timedOut ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}
