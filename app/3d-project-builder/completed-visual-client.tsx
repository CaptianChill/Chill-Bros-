"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Play, RefreshCcw, WandSparkles } from "lucide-react";

type Brief = { customer?: string; address?: string; projectTitle?: string; requestedChanges?: string; finishedProduct?: string; fieldNotes?: string };
type StoredPhoto = { id: number; name: string; type: string; blob: Blob };
type PhotoPreview = StoredPhoto & { url: string };
type RenderProfile = "draft" | "professional" | "photorealistic";
type SavedRender = {
  id: number;
  image: string;
  prompt: string;
  sourceName: string;
  updatedAt: string;
  renderProfile?: RenderProfile;
  environment?: string;
  presentation?: string;
};

const BRIEF_KEY = "chillbros.3dProjectBrief.v1";
const RENDER_KEY = "chillbros.completedVisual.v1";

const renderProfiles: Array<{ id: RenderProfile; label: string; detail: string }> = [
  { id: "draft", label: "Draft", detail: "Fast concept check" },
  { id: "professional", label: "Professional", detail: "Customer presentation" },
  { id: "photorealistic", label: "Photorealistic", detail: "Maximum realism" },
];

const environments = [
  "Match the real source environment",
  "Residential interior",
  "Residential exterior",
  "Commercial rooftop",
  "Commercial kitchen",
  "Walk-in cooler / freezer",
  "Mechanical room",
  "Clean equipment studio",
];

const presentations = [
  "Installed finished-project view",
  "Before / after completion view",
  "Equipment-focused close view",
  "Wide customer presentation view",
  "Mechanical installation detail view",
];

async function loadPhotos(): Promise<StoredPhoto[]> {
  return new Promise((resolve) => {
    const req = indexedDB.open("chillbros-photo-blueprints", 1);
    req.onerror = () => resolve([]);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos", { keyPath: "id" });
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("photos", "readonly");
      const get = tx.objectStore("photos").getAll();
      get.onerror = () => { db.close(); resolve([]); };
      get.onsuccess = () => { const rows = (get.result ?? []) as StoredPhoto[]; db.close(); resolve(rows.sort((a,b)=>a.id-b.id)); };
    };
  });
}

async function openRenderDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("chillbros-completed-visuals", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("renders")) db.createObjectStore("renders", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveRender(render: SavedRender) {
  const db = await openRenderDb();
  const tx = db.transaction("renders", "readwrite");
  tx.objectStore("renders").put(render);
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close();
}

async function getRender(id: number): Promise<SavedRender | null> {
  const db = await openRenderDb();
  const tx = db.transaction("renders", "readonly");
  const req = tx.objectStore("renders").get(id);
  const value = await new Promise<SavedRender | null>((resolve, reject) => { req.onsuccess = () => resolve((req.result as SavedRender) || null); req.onerror = () => reject(req.error); });
  db.close();
  return value;
}

export default function CompletedVisualClient({ onBackToModel }: { onBackToModel: () => void }) {
  const [brief, setBrief] = useState<Brief>({});
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [selected, setSelected] = useState(0);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [renderUrl, setRenderUrl] = useState("");
  const [rendering, setRendering] = useState(false);
  const [renderProfile, setRenderProfile] = useState<RenderProfile>("photorealistic");
  const [environment, setEnvironment] = useState(environments[0]);
  const [presentation, setPresentation] = useState(presentations[0]);
  const [renderMeta, setRenderMeta] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BRIEF_KEY);
      if (raw) setBrief(JSON.parse(raw));
      const prior = localStorage.getItem(RENDER_KEY);
      if (prior) {
        const saved = JSON.parse(prior);
        setNotes(saved?.notes ?? "");
        if (saved?.renderProfile) setRenderProfile(saved.renderProfile);
        if (saved?.environment) setEnvironment(saved.environment);
        if (saved?.presentation) setPresentation(saved.presentation);
      }
    } catch {}
    loadPhotos().then((rows)=>setPhotos(rows.map((row)=>({ ...row, url: URL.createObjectURL(row.blob) }))));
  }, []);

  useEffect(() => () => photos.forEach((p)=>URL.revokeObjectURL(p.url)), [photos]);

  useEffect(() => {
    setRenderUrl("");
    setRenderMeta("");
    getRender(selected).then((saved) => {
      if (!saved?.image) return;
      setRenderUrl(saved.image);
      if (saved.renderProfile) setRenderProfile(saved.renderProfile);
      if (saved.environment) setEnvironment(saved.environment);
      if (saved.presentation) setPresentation(saved.presentation);
      setRenderMeta(saved.renderProfile ? `${saved.renderProfile} render` : "saved render");
    }).catch(() => undefined);
  }, [selected]);

  const prompt = useMemo(() => [
    `Property: ${brief.address || "unspecified"}`,
    `Project: ${brief.projectTitle || "renovation concept"}`,
    `Customer changes: ${brief.requestedChanges || "not entered"}`,
    `Finished target: ${brief.finishedProduct || "not entered"}`,
    `Field notes / measurements: ${brief.fieldNotes || "not entered"}`,
    `Additional visual instructions: ${notes || "none"}`,
    `Environment: ${environment}`,
    `Presentation: ${presentation}`,
    "Create a photorealistic completed-renovation version of the supplied property photo.",
    "Preserve the recognizable property geometry, camera viewpoint, perspective, window and door locations, and unchanged surroundings unless the project instructions explicitly change them.",
    "Apply only the repairs, finishes, equipment, materials, landscaping, and customer-requested changes described above.",
    "Use realistic construction details, materials, equipment scale, installation clearances, shadows, reflections, surface roughness, and natural lighting.",
    "Make the result look like a believable professionally photographed completed project, not an architectural sketch, game render, or fantasy image.",
    "Do not add structural changes that are unsupported by the project notes or measurements."
  ].join("\n"), [brief, notes, environment, presentation]);

  const source = photos[selected];

  async function generateRender() {
    if (!source) {
      setStatus("Add and save at least one real property photo first.");
      return;
    }
    setRendering(true);
    setStatus(renderProfile === "photorealistic" ? "Building the high-detail photorealistic completion image..." : "Generating the completed-project image...");
    setRenderUrl("");
    setRenderMeta("");
    try {
      const body = new FormData();
      body.append("image", new File([source.blob], source.name || "property-photo.png", { type: source.type || "image/png" }));
      body.append("prompt", prompt);
      body.append("renderProfile", renderProfile);
      body.append("environment", environment);
      body.append("presentation", presentation);
      const response = await fetch("/api/3d-project-builder/render", { method: "POST", body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.image) throw new Error(payload?.error || "The finished visual could not be generated.");
      setRenderUrl(payload.image);
      setRenderMeta(`${payload.renderProfile || renderProfile} · ${payload.quality || "high"}`);
      const saved: SavedRender = {
        id: selected,
        image: payload.image,
        prompt,
        sourceName: source.name,
        updatedAt: new Date().toISOString(),
        renderProfile,
        environment,
        presentation,
      };
      await saveRender(saved).catch(() => undefined);
      localStorage.setItem(RENDER_KEY, JSON.stringify({ prompt, notes, selectedPhoto: selected, renderProfile, environment, presentation, updatedAt: saved.updatedAt }));
      setStatus("Photorealistic project visual generated and saved with this source photo on this device.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The finished visual could not be generated.");
    } finally {
      setRendering(false);
    }
  }

  function downloadRender() {
    if (!renderUrl) return;
    const a = document.createElement("a");
    a.href = renderUrl;
    a.download = `${(brief.projectTitle || "completed-project").replace(/[^a-z0-9]+/gi,"-").toLowerCase()}-${selected+1}.png`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-[#8ffafa]/30 bg-[#06111b]/90 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8ffafa]">Photoreal Render Studio</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Turn the real property photo into the proposed finished project</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Keep the actual property as the source of truth, then generate a customer-ready completion image with realistic materials, lighting, shadows, equipment scale, and installation details.</p>
          </div>
          <button onClick={onBackToModel} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#2d7dff]/25 px-3 text-xs text-[#d9fbff]"><ArrowLeft className="h-3.5 w-3.5"/>Back to model</button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Source photos</p>
          {photos.length ? <div className="mt-3 grid grid-cols-3 gap-2">{photos.map((photo,i)=><button key={photo.name+i} onClick={()=>setSelected(i)} className={`overflow-hidden rounded-xl border ${i===selected?"border-[#8ffafa]/80":"border-[#2d7dff]/20"}`}><img src={photo.url} alt={photo.name} className="aspect-square w-full object-cover"/></button>)}</div> : <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">No source photos are stored yet. Return to 3D Model & Measurements and add the real property photos first.</p>}

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Render quality</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {renderProfiles.map((item) => (
                <button key={item.id} type="button" onClick={()=>setRenderProfile(item.id)} className={`rounded-xl border p-2 text-left transition ${renderProfile===item.id?"border-[#8ffafa]/70 bg-[#2d7dff]/18":"border-[#2d7dff]/20 bg-black/40"}`}>
                  <span className="block text-xs font-semibold text-white">{item.label}</span>
                  <span className="mt-1 block text-[10px] leading-4 text-zinc-500">{item.detail}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-zinc-400">Environment<select value={environment} onChange={(e)=>setEnvironment(e.target.value)} className="min-h-11 rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-sm text-white outline-none">{environments.map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
            <label className="grid gap-1 text-xs text-zinc-400">Presentation<select value={presentation} onChange={(e)=>setPresentation(e.target.value)} className="min-h-11 rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-sm text-white outline-none">{presentations.map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
          </div>

          <label className="mt-4 grid gap-1 text-xs text-zinc-400">Finished visual instructions<textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Repair drywall, new siding, white walls, oak flooring, new mini splits, updated kitchen, landscaping..." className="min-h-32 rounded-xl border border-[#2d7dff]/25 bg-black p-3 text-sm text-white outline-none placeholder:text-zinc-600"/></label>
          <button disabled={rendering || !source} onClick={generateRender} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/55 bg-[#2d7dff]/18 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><WandSparkles className="h-4 w-4"/>{rendering ? "Rendering realistic image..." : renderProfile === "photorealistic" ? "Create photorealistic render" : "Generate finished visual"}</button>
          {status ? <p className="mt-3 text-xs leading-5 text-[#d9fbff]">{status}</p> : null}
        </section>

        <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Before / After workspace</p><h3 className="mt-1 text-lg font-semibold text-white">Customer presentation view</h3></div>
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-[#8ffafa]/25 bg-[#8ffafa]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-[#d9fbff]">{renderProfile}</span><span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-amber-200">Concept · field verify</span></div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-[#2d7dff]/20 bg-[#02060d]"><div className="border-b border-[#2d7dff]/15 px-3 py-2 text-xs font-semibold text-zinc-300">BEFORE</div>{source?<img src={source.url} alt={source.name} className="aspect-[4/3] w-full object-cover"/>:<div className="grid aspect-[4/3] place-items-center text-sm text-zinc-600">Add a source photo</div>}</div>
            <div className="overflow-hidden rounded-2xl border border-[#8ffafa]/25 bg-[#02060d]"><div className="flex items-center justify-between border-b border-[#8ffafa]/15 px-3 py-2"><span className="text-xs font-semibold text-[#d9fbff]">AFTER · REALISTIC RENDER</span>{renderMeta?<span className="text-[10px] uppercase tracking-[.12em] text-zinc-500">{renderMeta}</span>:null}</div>{renderUrl?<img src={renderUrl} alt="Photorealistic completed-project concept" className="aspect-[4/3] w-full object-cover"/>:<div className="grid aspect-[4/3] place-items-center bg-[radial-gradient(circle_at_center,_rgba(45,125,255,.12),_transparent_65%)] px-6 text-center"><div><WandSparkles className="mx-auto h-8 w-8 text-[#8ffafa]"/><p className="mt-3 text-sm font-semibold text-white">Photoreal render output</p><p className="mt-2 text-xs leading-5 text-zinc-500">Choose a source photo, set the environment, and create the proposed finished-project image.</p></div></div>}</div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3"><Link href="/3d-project-builder/walkthrough" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/40 bg-[#8ffafa]/10 font-semibold text-white"><Play className="h-4 w-4"/>Open walkthrough</Link><button disabled={!renderUrl} onClick={downloadRender} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/30 bg-black font-semibold text-white disabled:opacity-40"><Download className="h-4 w-4"/>Save image</button><button onClick={()=>{setSelected(0);setRenderUrl("");setRenderMeta("");setStatus("")}} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/25 bg-black font-semibold text-white"><RefreshCcw className="h-4 w-4"/>Reset preview</button></div>
        </section>
      </div>
    </div>
  );
}
