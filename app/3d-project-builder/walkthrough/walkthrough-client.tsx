"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, DoorOpen, Maximize2, RotateCcw } from "lucide-react";

type Room = { id: string; name: string; width: number; depth: number; height: number; verified: boolean };
type Blueprint = { name: string; notes: string; rooms: Room[]; updatedAt?: string };
type Brief = { customer?: string; address?: string; projectTitle?: string; requestedChanges?: string; finishedProduct?: string; fieldNotes?: string };

type StoredPhoto = { id: number; name: string; type: string; blob: Blob };

const BLUEPRINT_KEY = "chillbros.photoBlueprint.v1";
const BRIEF_KEY = "chillbros.3dProjectBrief.v1";

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

export default function WalkthroughClient() {
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [brief, setBrief] = useState<Brief>({});
  const [roomIndex, setRoomIndex] = useState(0);
  const [yaw, setYaw] = useState(0);
  const [photos, setPhotos] = useState<Array<{name:string;url:string}>>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BLUEPRINT_KEY);
      if (raw) setBlueprint(JSON.parse(raw));
      const briefRaw = localStorage.getItem(BRIEF_KEY);
      if (briefRaw) setBrief(JSON.parse(briefRaw));
    } catch {}
    loadPhotos().then((rows) => setPhotos(rows.map((row) => ({ name: row.name, url: URL.createObjectURL(row.blob) }))));
  }, []);

  useEffect(() => () => photos.forEach((p)=>URL.revokeObjectURL(p.url)), [photos]);

  const rooms = blueprint?.rooms ?? [];
  const room = rooms[roomIndex] ?? null;
  const title = brief.projectTitle || blueprint?.name || "3D Project Walkthrough";
  const wallScale = room ? Math.min(1.22, Math.max(.72, room.width / 12)) : 1;
  const depthScale = room ? Math.min(1.25, Math.max(.72, room.depth / 12)) : 1;
  const ceilingScale = room ? Math.min(1.18, Math.max(.78, room.height / 8)) : 1;
  const status = room?.verified ? "FIELD VERIFIED" : "CONCEPT · VERIFY IN FIELD";
  const source = photos.length ? photos[roomIndex % photos.length] : null;

  const roomStrip = useMemo(() => rooms.map((r,i)=>({ ...r, index:i })), [rooms]);

  if (!room) {
    return <section className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5 text-sm text-amber-100">No saved blueprint rooms were found on this device. Return to 3D Project Builder, add measurements, and press <strong>Save project</strong> first.</section>;
  }

  function prev() { setRoomIndex((i)=>(i-1+rooms.length)%rooms.length); setYaw(0); }
  function next() { setRoomIndex((i)=>(i+1)%rooms.length); setYaw(0); }

  return <div className="space-y-4">
    <section className="rounded-3xl border border-[#8ffafa]/30 bg-[#06111b]/90 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8ffafa]">Live walkthrough</p><h2 className="mt-1 text-xl font-semibold text-white">{title}</h2><p className="mt-1 text-sm text-zinc-400">{brief.address || "Standalone project"}</p></div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold tracking-[0.16em] ${room.verified?"border-emerald-400/30 bg-emerald-500/10 text-emerald-200":"border-amber-400/30 bg-amber-500/10 text-amber-200"}`}>{status}</span>
      </div>
    </section>

    <section className="overflow-hidden rounded-3xl border border-[#2d7dff]/30 bg-[#01040a]">
      <div className="relative min-h-[500px] overflow-hidden bg-[radial-gradient(circle_at_center,_rgba(45,125,255,.15),_transparent_64%)] [perspective:900px]">
        <div className="absolute inset-0 transition-transform duration-300 [transform-style:preserve-3d]" style={{transform:`rotateY(${yaw}deg) scale(${Math.min(wallScale,1.05)})`}}>
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[500px] -translate-x-1/2 -translate-y-1/2 border border-[#8ffafa]/35 bg-[#07101d] shadow-[inset_0_0_80px_rgba(45,125,255,.08)]" style={{transform:`translateZ(-180px) scaleX(${wallScale}) scaleY(${ceilingScale})`}}>
            {source ? <img src={source.url} alt={source.name} className="h-full w-full object-cover opacity-30 mix-blend-screen"/> : null}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50"/>
          </div>
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[360px] origin-right -translate-x-[430px] -translate-y-1/2 border border-[#2d7dff]/30 bg-[#040914]" style={{transform:`rotateY(78deg) translateZ(-5px) scaleX(${depthScale}) scaleY(${ceilingScale})`}}/>
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[360px] origin-left translate-x-[70px] -translate-y-1/2 border border-[#2d7dff]/30 bg-[#040914]" style={{transform:`rotateY(-78deg) translateZ(-5px) scaleX(${depthScale}) scaleY(${ceilingScale})`}}/>
          <div className="absolute left-1/2 top-1/2 h-[340px] w-[500px] -translate-x-1/2 translate-y-[115px] origin-top border border-[#2d7dff]/25 bg-[linear-gradient(rgba(45,125,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(45,125,255,.08)_1px,transparent_1px)] bg-[size:38px_38px] bg-[#03070d]" style={{transform:`rotateX(74deg) scaleX(${wallScale}) scaleY(${depthScale})`}}/>
          <div className="absolute left-1/2 top-1/2 h-[260px] w-[500px] -translate-x-1/2 -translate-y-[280px] origin-bottom border border-[#2d7dff]/20 bg-[#02060d]" style={{transform:`rotateX(-77deg) scaleX(${wallScale})`}}/>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-5 mx-auto w-[min(92%,620px)] rounded-2xl border border-[#8ffafa]/20 bg-black/70 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-[#8ffafa]">{room.name}</p><p className="mt-1 text-lg font-semibold text-white">{room.width}' × {room.depth}' × {room.height}'</p></div><DoorOpen className="h-6 w-6 text-[#8ffafa]"/></div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 border-t border-[#2d7dff]/20 p-3">
        <button onClick={prev} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[#2d7dff]/25 bg-black text-sm text-white"><ChevronLeft className="h-4 w-4"/>Room</button>
        <button onClick={()=>setYaw((v)=>Math.max(-28,v-8))} className="min-h-11 rounded-xl border border-[#2d7dff]/25 bg-black text-sm text-white">Look left</button>
        <button onClick={()=>setYaw((v)=>Math.min(28,v+8))} className="min-h-11 rounded-xl border border-[#2d7dff]/25 bg-black text-sm text-white">Look right</button>
        <button onClick={next} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[#2d7dff]/25 bg-black text-sm text-white">Room<ChevronRight className="h-4 w-4"/></button>
      </div>
      <div className="flex flex-wrap gap-2 px-3 pb-3">
        <button onClick={()=>setYaw(0)} className="inline-flex items-center gap-2 rounded-xl border border-[#8ffafa]/25 px-3 py-2 text-xs text-[#d9fbff]"><RotateCcw className="h-3.5 w-3.5"/>Reset view</button>
        <button onClick={()=>document.documentElement.requestFullscreen?.()} className="inline-flex items-center gap-2 rounded-xl border border-[#8ffafa]/25 px-3 py-2 text-xs text-[#d9fbff]"><Maximize2 className="h-3.5 w-3.5"/>Fullscreen</button>
      </div>
    </section>

    <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Rooms</p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{roomStrip.map((r)=><button key={r.id} onClick={()=>{setRoomIndex(r.index);setYaw(0)}} className={`shrink-0 rounded-xl border px-3 py-2 text-xs ${r.index===roomIndex?"border-[#8ffafa]/60 bg-[#2d7dff]/20 text-white":"border-[#2d7dff]/20 bg-black text-zinc-400"}`}>{r.name}</button>)}</div>
      {brief.finishedProduct ? <div className="mt-4 rounded-2xl border border-[#8ffafa]/15 bg-[#8ffafa]/5 p-3"><p className="text-[10px] uppercase tracking-[0.16em] text-[#8ffafa]">Finished-product target</p><p className="mt-1 text-sm leading-6 text-zinc-300">{brief.finishedProduct}</p></div> : null}
    </section>
  </div>;
}
