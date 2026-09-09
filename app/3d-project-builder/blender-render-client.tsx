"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Cpu, Download, RefreshCcw } from "lucide-react";

type Room = { id: string; name: string; width: number; depth: number; height: number; verified: boolean };
type Blueprint = { name?: string; notes?: string; rooms?: Room[]; updatedAt?: string };
type Brief = {
  customer?: string;
  address?: string;
  projectTitle?: string;
  requestedChanges?: string;
  finishedProduct?: string;
  fieldNotes?: string;
};

type EngineState = { configured: boolean; online?: boolean; engine?: string };

const BLUEPRINT_KEY = "chillbros.photoBlueprint.v1";
const BRIEF_KEY = "chillbros.3dProjectBrief.v1";
const BLENDER_META_KEY = "chillbros.blenderRender.v1";

function readSaved<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function BlenderRenderClient() {
  const [blueprint, setBlueprint] = useState<Blueprint>({ rooms: [] });
  const [brief, setBrief] = useState<Brief>({});
  const [engine, setEngine] = useState<EngineState>({ configured: false });
  const [checking, setChecking] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [status, setStatus] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const refreshSavedProject = useCallback(() => {
    setBlueprint(readSaved<Blueprint>(BLUEPRINT_KEY, { rooms: [] }));
    setBrief(readSaved<Brief>(BRIEF_KEY, {}));
  }, []);

  const checkEngine = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/3d-project-builder/blender", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      setEngine({
        configured: Boolean(payload?.configured),
        online: Boolean(payload?.online),
        engine: payload?.engine || "blender-cycles",
      });
    } catch {
      setEngine({ configured: false, online: false, engine: "blender-cycles" });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refreshSavedProject();
    checkEngine();
    const onSave = () => refreshSavedProject();
    window.addEventListener("chillbros:save-visualizer", onSave);
    return () => window.removeEventListener("chillbros:save-visualizer", onSave);
  }, [checkEngine, refreshSavedProject]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  async function renderBlenderScene() {
    refreshSavedProject();
    const savedBlueprint = readSaved<Blueprint>(BLUEPRINT_KEY, { rooms: [] });
    const savedBrief = readSaved<Brief>(BRIEF_KEY, {});
    const rooms = savedBlueprint.rooms ?? [];

    if (!rooms.length) {
      setStatus("Save at least one room and its measurements in Step 2 before starting Blender.");
      return;
    }

    setRendering(true);
    setStatus("Sending the measured scene to Blender Cycles. This is a real 3D render, not the AI after-image.");

    try {
      const response = await fetch("/api/3d-project-builder/blender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: savedBlueprint.name || savedBrief.projectTitle || "Chill Bros Project",
          notes: savedBlueprint.notes || "",
          rooms,
          brief: savedBrief,
          environment: "professional architectural studio",
          presentation: "wide customer presentation",
          samples: 96,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.startsWith("image/")) {
        const payload = contentType.includes("application/json")
          ? await response.json().catch(() => ({}))
          : { error: await response.text().catch(() => "") };
        const detail = typeof payload?.detail === "string" && payload.detail ? ` ${payload.detail}` : "";
        throw new Error(`${payload?.error || "Blender render failed."}${detail}`.trim());
      }

      const blob = await response.blob();
      const nextUrl = URL.createObjectURL(blob);
      setImageUrl((prior) => {
        if (prior) URL.revokeObjectURL(prior);
        return nextUrl;
      });
      localStorage.setItem(
        BLENDER_META_KEY,
        JSON.stringify({
          projectName: savedBlueprint.name || savedBrief.projectTitle || "Chill Bros Project",
          roomCount: rooms.length,
          engine: response.headers.get("x-chillbros-render-engine") || "blender-cycles",
          updatedAt: new Date().toISOString(),
        }),
      );
      setStatus("Blender Cycles render completed. The PNG below came from the measured 3D scene.");
      setEngine({ configured: true, online: true, engine: "blender-cycles" });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Blender render failed.");
      await checkEngine();
    } finally {
      setRendering(false);
    }
  }

  function downloadRender() {
    if (!imageUrl) return;
    const title = blueprint.name || brief.projectTitle || "chill-bros-project";
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-blender-render.png`;
    a.click();
  }

  const roomCount = blueprint.rooms?.length ?? 0;
  const engineLabel = checking
    ? "Checking Blender…"
    : engine.configured && engine.online
      ? "Blender Cycles online"
      : engine.configured
        ? "Blender worker offline"
        : "Blender worker not connected";

  return (
    <section className="rounded-3xl border border-[#8ffafa]/35 bg-[#03101b]/95 p-4 shadow-[0_0_30px_rgba(45,125,255,.12)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8ffafa]">Blender Render Engine</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Measured model → PBR scene → Cycles PNG</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Uses the saved room dimensions to build real Blender geometry with walls, flooring, trim, physical materials, camera perspective, shadows, and studio lighting. HVAC keywords such as mini split or RTU also add mechanical equipment geometry to the scene.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] ${engine.configured && engine.online ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200" : "border-amber-400/30 bg-amber-500/10 text-amber-200"}`}>
          <Cpu className="mr-1.5 inline h-3.5 w-3.5" />{engineLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3"><p className="text-[10px] uppercase tracking-[.14em] text-zinc-500">Saved rooms</p><p className="mt-1 text-xl font-semibold text-white">{roomCount}</p></div>
        <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3"><p className="text-[10px] uppercase tracking-[.14em] text-zinc-500">Renderer</p><p className="mt-1 text-sm font-semibold text-white">Cycles + denoise</p></div>
        <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3"><p className="text-[10px] uppercase tracking-[.14em] text-zinc-500">Output</p><p className="mt-1 text-sm font-semibold text-white">1536 × 1024 PNG</p></div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <button type="button" disabled={rendering || roomCount < 1} onClick={renderBlenderScene} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/50 bg-[#2d7dff]/18 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
          <Box className="h-4 w-4" />{rendering ? "Rendering in Blender…" : "Render saved model in Blender"}
        </button>
        <button type="button" onClick={()=>{refreshSavedProject(); checkEngine();}} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 text-sm font-semibold text-white">
          <RefreshCcw className="h-4 w-4" />Refresh
        </button>
      </div>

      {status ? <p className="mt-3 rounded-xl border border-[#8ffafa]/15 bg-black/35 px-3 py-2 text-xs leading-5 text-[#d9fbff]">{status}</p> : null}

      {imageUrl ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#8ffafa]/25 bg-black">
          <div className="flex items-center justify-between gap-3 border-b border-[#8ffafa]/15 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-[.14em] text-[#d9fbff]">Blender Cycles render</span>
            <button type="button" onClick={downloadRender} className="inline-flex items-center gap-1.5 rounded-lg border border-[#8ffafa]/30 px-2.5 py-1.5 text-xs font-semibold text-white"><Download className="h-3.5 w-3.5"/>Save PNG</button>
          </div>
          <img src={imageUrl} alt="Blender Cycles render of saved Chill Bros project" className="aspect-[3/2] w-full object-contain" />
        </div>
      ) : null}
    </section>
  );
}
