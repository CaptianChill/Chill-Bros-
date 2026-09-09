"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Cpu, Download, RefreshCcw, WandSparkles } from "lucide-react";

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

function buildPhotorealPrompt(blueprint: Blueprint, brief: Brief, rooms: Room[]) {
  const measuredRooms = rooms
    .map((room) => `${room.name}: ${room.width} ft × ${room.depth} ft × ${room.height} ft${room.verified ? " (field verified)" : ""}`)
    .join("; ");

  return [
    `Project: ${blueprint.name || brief.projectTitle || "Chill Bros Project"}`,
    `Customer: ${brief.customer || "not entered"}`,
    `Property: ${brief.address || "not entered"}`,
    `Measured rooms: ${measuredRooms}`,
    `Requested changes: ${brief.requestedChanges || "not entered"}`,
    `Finished target: ${brief.finishedProduct || "not entered"}`,
    `Field notes: ${brief.fieldNotes || "not entered"}`,
    `Model notes: ${blueprint.notes || "none"}`,
    "Use the supplied Blender Cycles render as the geometry, scale, camera, equipment-placement, and room-layout reference for the finished image.",
    "Convert the clean 3D source into a believable high-end construction completion photograph while preserving the measured geometry and all supported project details.",
    "Replace obvious CGI surfaces with realistic building materials, subtle imperfections, physically plausible reflections, natural global illumination, contact shadows, practical installation details, fasteners, seams, trim, equipment clearances, conduit, drains, line sets, and mounting hardware when applicable.",
    "Do not invent unsupported structural changes, move walls, distort openings, change camera perspective, float equipment, add fake signage, or alter measured proportions.",
    "The final result should read as a real professional photograph of the completed work, not a concept sketch, game render, or glossy toy-like CGI image.",
  ].join("\n");
}

export default function BlenderRenderClient() {
  const [blueprint, setBlueprint] = useState<Blueprint>({ rooms: [] });
  const [brief, setBrief] = useState<Brief>({});
  const [engine, setEngine] = useState<EngineState>({ configured: false });
  const [checking, setChecking] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [status, setStatus] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [photorealUrl, setPhotorealUrl] = useState("");
  const [photorealMeta, setPhotorealMeta] = useState("");

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
      setStatus("Save at least one room and its measurements in Step 2 before starting the render.");
      return;
    }

    setRendering(true);
    setPhotorealUrl("");
    setPhotorealMeta("");
    setStatus("Stage 1 of 2: sending the measured scene to Blender Cycles.");

    let blenderBlob: Blob;
    let blenderEngine = "blender-cycles";

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

      blenderBlob = await response.blob();
      if (!blenderBlob.size) throw new Error("Blender returned an empty render.");
      blenderEngine = response.headers.get("x-chillbros-render-engine") || "blender-cycles";

      const nextUrl = URL.createObjectURL(blenderBlob);
      setImageUrl((prior) => {
        if (prior) URL.revokeObjectURL(prior);
        return nextUrl;
      });
      setEngine({ configured: true, online: true, engine: blenderEngine });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Blender render failed.");
      await checkEngine();
      setRendering(false);
      return;
    }

    setStatus("Stage 2 of 2: Cycles geometry is complete. Applying the photoreal construction finish.");

    try {
      const body = new FormData();
      body.append(
        "image",
        new File([blenderBlob], "chill-bros-cycles-source.png", { type: blenderBlob.type || "image/png" }),
      );
      body.append("prompt", buildPhotorealPrompt(savedBlueprint, savedBrief, rooms));
      body.append("renderProfile", "photorealistic");
      body.append("environment", "Match the measured Blender scene with realistic installed construction materials");
      body.append("presentation", "Wide customer presentation view");

      const response = await fetch("/api/3d-project-builder/render", { method: "POST", body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.image) {
        const providerDetail = payload?.providerCode ? ` (${payload.providerCode})` : "";
        throw new Error(`${payload?.error || "Photoreal finish failed."}${providerDetail}`);
      }

      setPhotorealUrl(payload.image);
      setPhotorealMeta(
        `${payload.model || "image model"} · ${payload.quality || "high"}${payload.fallbackUsed ? " · compatibility fallback" : ""}`,
      );

      localStorage.setItem(
        BLENDER_META_KEY,
        JSON.stringify({
          projectName: savedBlueprint.name || savedBrief.projectTitle || "Chill Bros Project",
          roomCount: rooms.length,
          engine: blenderEngine,
          photorealModel: payload.model || null,
          photorealQuality: payload.quality || null,
          fallbackUsed: Boolean(payload.fallbackUsed),
          updatedAt: new Date().toISOString(),
        }),
      );
      setStatus("Finished photoreal image completed from the measured Blender scene. The raw Cycles source is kept below for verification.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Photoreal finish failed.";
      setStatus(`Blender Cycles completed successfully, but the photoreal finishing stage failed: ${message}`);
      localStorage.setItem(
        BLENDER_META_KEY,
        JSON.stringify({
          projectName: savedBlueprint.name || savedBrief.projectTitle || "Chill Bros Project",
          roomCount: rooms.length,
          engine: blenderEngine,
          photorealError: message,
          updatedAt: new Date().toISOString(),
        }),
      );
    } finally {
      setRendering(false);
    }
  }

  function downloadRender(url: string, suffix: string) {
    if (!url) return;
    const title = blueprint.name || brief.projectTitle || "chill-bros-project";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${suffix}.png`;
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
          <h3 className="mt-1 text-lg font-semibold text-white">Measured model → Cycles → finished photoreal image</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Builds real geometry from the saved room measurements, renders that scene in Blender Cycles, then uses the Cycles PNG as the controlled source for the final customer-ready photoreal finish. The measured source remains visible so the finished image can be checked against it.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] ${engine.configured && engine.online ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200" : "border-amber-400/30 bg-amber-500/10 text-amber-200"}`}>
          <Cpu className="mr-1.5 inline h-3.5 w-3.5" />{engineLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3"><p className="text-[10px] uppercase tracking-[.14em] text-zinc-500">Saved rooms</p><p className="mt-1 text-xl font-semibold text-white">{roomCount}</p></div>
        <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3"><p className="text-[10px] uppercase tracking-[.14em] text-zinc-500">3D renderer</p><p className="mt-1 text-sm font-semibold text-white">Cycles + denoise</p></div>
        <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3"><p className="text-[10px] uppercase tracking-[.14em] text-zinc-500">Final output</p><p className="mt-1 text-sm font-semibold text-white">1536 × 1024 photoreal</p></div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <button type="button" disabled={rendering || roomCount < 1} onClick={renderBlenderScene} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/50 bg-[#2d7dff]/18 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
          <WandSparkles className="h-4 w-4" />{rendering ? "Building finished visual…" : "Render finished photoreal project"}
        </button>
        <button type="button" onClick={()=>{refreshSavedProject(); checkEngine();}} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 text-sm font-semibold text-white">
          <RefreshCcw className="h-4 w-4" />Refresh
        </button>
      </div>

      {status ? <p className="mt-3 rounded-xl border border-[#8ffafa]/15 bg-black/35 px-3 py-2 text-xs leading-5 text-[#d9fbff]">{status}</p> : null}

      {photorealUrl || imageUrl ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {photorealUrl ? (
            <div className="overflow-hidden rounded-2xl border border-[#8ffafa]/35 bg-black">
              <div className="flex items-center justify-between gap-3 border-b border-[#8ffafa]/15 px-3 py-2">
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-[.14em] text-[#d9fbff]">Finished photoreal image</span>
                  {photorealMeta ? <span className="mt-0.5 block text-[10px] text-zinc-500">{photorealMeta}</span> : null}
                </div>
                <button type="button" onClick={()=>downloadRender(photorealUrl, "photoreal-finished")} className="inline-flex items-center gap-1.5 rounded-lg border border-[#8ffafa]/30 px-2.5 py-1.5 text-xs font-semibold text-white"><Download className="h-3.5 w-3.5"/>Save</button>
              </div>
              <img src={photorealUrl} alt="Finished photoreal Chill Bros project visualization" className="aspect-[3/2] w-full object-contain" />
            </div>
          ) : null}

          {imageUrl ? (
            <div className="overflow-hidden rounded-2xl border border-[#2d7dff]/25 bg-black">
              <div className="flex items-center justify-between gap-3 border-b border-[#2d7dff]/15 px-3 py-2">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-zinc-300"><Box className="h-3.5 w-3.5"/>Measured Cycles source</div>
                <button type="button" onClick={()=>downloadRender(imageUrl, "blender-cycles-source")} className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d7dff]/30 px-2.5 py-1.5 text-xs font-semibold text-white"><Download className="h-3.5 w-3.5"/>Save</button>
              </div>
              <img src={imageUrl} alt="Blender Cycles render of saved Chill Bros project" className="aspect-[3/2] w-full object-contain" />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
