"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ImageSparkles, Play, RefreshCcw } from "lucide-react";

type Brief = { customer?: string; address?: string; projectTitle?: string; requestedChanges?: string; finishedProduct?: string; fieldNotes?: string };
type StoredPhoto = { id: number; name: string; type: string; blob: Blob };

const BRIEF_KEY = "chillbros.3dProjectBrief.v1";
const RENDER_KEY = "chillbros.completedVisual.v1";

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

export default function CompletedVisualClient({ onBackToModel }: { onBackToModel: () => void }) {
  const [brief, setBrief] = useState<Brief>({});
  const [photos, setPhotos] = useState<Array<{name:string;url:string}>>([]);
  const [selected, setSelected] = useState(0);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BRIEF_KEY);
      if (raw) setBrief(JSON.parse(raw));
      const prior = localStorage.getItem(RENDER_KEY);
      if (prior) setNotes(JSON.parse(prior)?.notes ?? "");
    } catch {}
    loadPhotos().then((rows)=>setPhotos(rows.map((row)=>({name:row.name,url:URL.createObjectURL(row.blob)}))));
  }, []);

  useEffect(() => () => photos.forEach((p)=>URL.revokeObjectURL(p.url)), [photos]);

  function prepareRender() {
    const prompt = [
      `Property: ${brief.address || "unspecified"}`,
      `Project: ${brief.projectTitle || "renovation concept"}`,
      `Customer changes: ${brief.requestedChanges || "not entered"}`,
      `Finished target: ${brief.finishedProduct || "not entered"}`,
      `Additional visual notes: ${notes || "none"}`,
      "Preserve the recognizable geometry and camera viewpoint of the source property photo while showing a photorealistic completed renovation concept. Do not invent structural certainty where measurements are unverified."
    ].join("\n");
    localStorage.setItem(RENDER_KEY, JSON.stringify({ prompt, notes, selectedPhoto: selected, updatedAt: new Date().toISOString() }));
    setStatus("Finished-visual brief saved. The project is ready for the AI image-rendering backend connection.");
  }

  const source = photos[selected];

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-[#8ffafa]/30 bg-[#06111b]/90 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8ffafa]">Completed Visual (AI)</p><h2 className="mt-1 text-xl font-semibold text-white">Turn the real property photo into the proposed finished project</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Use the uploaded house photo as the visual anchor, then combine it with the project address, customer changes, measurements, and finished-product target.</p></div>
          <button onClick={onBackToModel} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff]"><ArrowLeft className="h-3.5 w-3.5"/>Back to model</button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Source photos</p>
          {photos.length ? <div className="mt-3 grid grid-cols-3 gap-2">{photos.map((photo,i)=><button key={photo.name+i} onClick={()=>setSelected(i)} className={`overflow-hidden rounded-xl border ${i===selected?"border-[#8ffafa]/80":"border-[#2d7dff]/20"}`}><img src={photo.url} alt={photo.name} className="aspect-square w-full object-cover"/></button>)}</div> : <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">No source photos are stored yet. Return to 3D Model & Measurements and add the house photos first.</p>}

          <label className="mt-4 grid gap-1 text-xs text-zinc-400">Finished visual instructions<textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="New siding, repaired drywall, modern kitchen, new mini splits, paint colors, flooring, landscaping..." className="min-h-32 rounded-xl border border-[#2d7dff]/25 bg-black p-3 text-sm text-white outline-none placeholder:text-zinc-600"/></label>
          <button onClick={prepareRender} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/55 bg-[#2d7dff]/18 font-semibold text-white"><ImageSparkles className="h-4 w-4"/>Prepare AI finished version</button>
          {status ? <p className="mt-3 text-xs leading-5 text-[#d9fbff]">{status}</p> : null}
        </section>

        <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Before / After workspace</p><h3 className="mt-1 text-lg font-semibold text-white">Customer presentation view</h3></div><span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-amber-200">Concept · field verify</span></div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-[#2d7dff]/20 bg-[#02060d]"><div className="border-b border-[#2d7dff]/15 px-3 py-2 text-xs font-semibold text-zinc-300">BEFORE</div>{source?<img src={source.url} alt={source.name} className="aspect-[4/3] w-full object-cover"/>:<div className="grid aspect-[4/3] place-items-center text-sm text-zinc-600">Add a source photo</div>}</div>
            <div className="overflow-hidden rounded-2xl border border-[#8ffafa]/25 bg-[#02060d]"><div className="border-b border-[#8ffafa]/15 px-3 py-2 text-xs font-semibold text-[#d9fbff]">AFTER · AI RENDER</div><div className="grid aspect-[4/3] place-items-center bg-[radial-gradient(circle_at_center,_rgba(45,125,255,.12),_transparent_65%)] px-6 text-center"><div><ImageSparkles className="mx-auto h-8 w-8 text-[#8ffafa]"/><p className="mt-3 text-sm font-semibold text-white">Finished render output</p><p className="mt-2 text-xs leading-5 text-zinc-500">This panel is now wired for the render brief. The next backend connection will place the photorealistic completed-project image here.</p></div></div></div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2"><Link href="/3d-project-builder/walkthrough" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/40 bg-[#8ffafa]/10 font-semibold text-white"><Play className="h-4 w-4"/>Open walkthrough</Link><button onClick={()=>{setSelected(0);setStatus("")}} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/25 bg-black font-semibold text-white"><RefreshCcw className="h-4 w-4"/>Reset preview</button></div>
        </section>
      </div>
    </div>
  );
}
