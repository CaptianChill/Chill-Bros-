import { getVercelOidcToken } from "@vercel/functions/oidc";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const WORKER_URL = "https://chill-bros-blender-renderer-v2.onrender.com";
const PROBE_KEY = "chill-bros-blender-e2e-0909";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("probe") !== PROBE_KEY) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let authorization = (process.env.BLENDER_RENDER_TOKEN || "").trim();
  try {
    if (!authorization) authorization = (await getVercelOidcToken()).trim();
  } catch (error) {
    return NextResponse.json(
      { ok: false, stage: "identity", error: error instanceof Error ? error.message : "Unable to obtain Vercel workload identity." },
      { status: 503 },
    );
  }

  if (!authorization) {
    return NextResponse.json({ ok: false, stage: "identity", error: "No Vercel workload identity token available." }, { status: 503 });
  }

  const payload = {
    projectName: "Chill Bros end-to-end render probe",
    notes: "mini split",
    rooms: [
      { id: "probe-room", name: "Probe Room", width: 10, depth: 10, height: 8, verified: true },
    ],
    brief: {
      projectTitle: "Blender Worker Probe",
      requestedChanges: "Install mini split",
      finishedProduct: "Completed mini split installation",
      fieldNotes: "Automated one-time connectivity test",
    },
    environment: "clean studio",
    presentation: "wide customer presentation",
    samples: 16,
    width: 640,
    height: 480,
  };

  try {
    const response = await fetch(`${WORKER_URL}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authorization}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(150_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return NextResponse.json(
        { ok: false, stage: "worker", workerStatus: response.status, detail: detail.slice(0, 1600) },
        { status: 502 },
      );
    }

    const bytes = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "";
    return NextResponse.json({
      ok: bytes.byteLength > 0 && contentType.startsWith("image/"),
      stage: "complete",
      workerStatus: response.status,
      contentType,
      bytes: bytes.byteLength,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, stage: "proxy", error: error instanceof Error ? error.message : "Probe failed" },
      { status: 502 },
    );
  }
}
