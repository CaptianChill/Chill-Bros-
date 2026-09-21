"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus, Save, Trash2 } from "lucide-react";

type Room = { id: string; name: string; width: number; depth: number; height: number; verified: boolean };
type SavedProject = { name: string; notes: string; rooms: Room[]; updatedAt: string };

const STORAGE_KEY = "chillbros.photoBlueprint.v1";
const newRoom = (index: number): Room => ({ id: crypto.randomUUID(), name: `Room ${index + 1}`, width: 12, depth: 12, height: 8, verified: false });

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("chillbros-photo-blueprints", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePhotos(files: File[]) {
  const db = await openDb();
  const tx = db.transaction("photos", "readwrite");
  const store = tx.objectStore("photos");
  store.clear();
  files.forEach((file, i) => store.put({ id: i, name: file.name, type: file.type, blob: file }));
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close();
}

type StoredPhotoRow = { id: number; name: string; type: string; blob: Blob };

async function loadPhotos(): Promise<File[]> {
  const db = await openDb();
  const tx = db.transaction("photos", "readonly");
  const req = tx.objectStore("photos").getAll();
  const rows = await new Promise<StoredPhotoRow[]>((resolve, reject) => { req.onsuccess = () => resolve(req.result ?? []); req.onerror = () => reject(req.error); });
  db.close();
  return rows.sort((a,b) => a.id - b.id).map((row) => new File([row.blob], row.name, { type: row.type }));
}

function isoPoint(x: number, y: number, z: number) {
  const sx = (x - y) * 0.72;
  const sy = (x + y) * 0.38 - z;
  return [sx, sy] as const;
}

function pointsToString(points: Array<readonly [number, number]>, ox: number, oy: number) {
  return points.map(([x,y]) => `${(x + ox).toFixed(1)},${(y + oy).toFixed(1)}`).join(" ");
}

export default function PhotoBlueprintClient() {
  const [projectName, setProjectName] = useState("New photo blueprint");
  const [notes, setNotes] = useState("");
  const [rooms, setRooms] = useState<Room[]>([newRoom(0)]);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    // Hydrating from localStorage can't run during SSR render (no `window`),
    // so this has to load post-mount and then setState once.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedProject;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjectName(saved.name || "New photo blueprint");
      setNotes(saved.notes || "");
      setRooms(saved.rooms?.length ? saved.rooms : [newRoom(0)]);
      loadPhotos().then(setFiles).catch(() => undefined);
    } catch { /* ignore damaged local cache */ }
  }, []);

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const placements = useMemo(() => {
    type RowState = { list: { room: Room; x: number; y: number }[]; x: number; y: number; rowDepth: number };
    const initial: RowState = { list: [], x: 0, y: 0, rowDepth: 0 };
    return rooms.reduce<RowState>((acc, room, index) => {
      let { x, y, rowDepth } = acc;
      if (index > 0 && index % 3 === 0) { x = 0; y += rowDepth + 3; rowDepth = 0; }
      const placed = { room, x, y };
      x += room.width + 3;
      rowDepth = Math.max(rowDepth, room.depth);
      return { list: [...acc.list, placed], x, y, rowDepth };
    }, initial).list;
  }, [rooms]);

  function updateRoom(id: string, field: keyof Room, value: string | number | boolean) {
    setRooms((current) => current.map((room) => room.id === id ? { ...room, [field]: value } : room));
  }

  async function saveProject() {
    const payload: SavedProject = { name: projectName.trim() || "Untitled blueprint", notes, rooms, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    try { await savePhotos(files); setMessage("Project and source photos saved on this device."); }
    catch { setMessage("Blueprint saved, but this browser blocked persistent photo storage."); }
  }

  function exportSvg() {
    if (!svgRef.current) return;
    const source = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(projectName || "photo-blueprint").replace(/[^a-z0-9]+/gi,"-").toLowerCase()}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-[#8ffafa]/30 bg-[#06111b]/90 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8ffafa]">Photo → 3D Blueprint</p>
        <h2 className="mt-1 text-xl font-semibold text-white">Build a field-verifiable 3D concept from site photos</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Upload the room photos, enter the best working dimensions you have, then generate a clean isometric blueprint. Every room stays marked unverified until you confirm it in the field.</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-zinc-400">Project name<input value={projectName} onChange={(e)=>setProjectName(e.target.value)} className="min-h-11 rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-white" /></label>
            <label className="grid gap-1 text-xs text-zinc-400">Field notes<input value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Known walls, doors, measurements..." className="min-h-11 rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-white" /></label>
          </div>

          <label className="mt-4 flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#8ffafa]/35 bg-[#2d7dff]/5 px-4 text-sm font-semibold text-[#d9fbff]">
            <ImagePlus className="h-5 w-5" /> Add site photos
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e)=>setFiles(Array.from(e.target.files ?? []).slice(0,12))} />
          </label>
          <p className="mt-2 text-xs text-zinc-500">Up to 12 JPEG, PNG, or WebP images. Photos are kept with this saved blueprint on this device.</p>

          {previews.length ? <div className="mt-3 grid grid-cols-3 gap-2">{previews.map(({file,url}) => <div key={file.name+file.lastModified} className="overflow-hidden rounded-xl border border-[#2d7dff]/20 bg-black"><img src={url} alt={file.name} className="aspect-square w-full object-cover"/><p className="truncate px-2 py-1 text-[10px] text-zinc-500">{file.name}</p></div>)}</div> : null}

          <div className="mt-5 flex items-center justify-between gap-3"><h3 className="font-semibold text-white">Working room dimensions</h3><button type="button" onClick={()=>setRooms((r)=>[...r,newRoom(r.length)])} className="rounded-xl border border-[#8ffafa]/30 px-3 py-2 text-xs font-semibold text-[#d9fbff]">+ Add room</button></div>
          <div className="mt-3 space-y-3">
            {rooms.map((room) => <div key={room.id} className="rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/70 p-3">
              <div className="grid gap-2 sm:grid-cols-2"><input value={room.name} onChange={(e)=>updateRoom(room.id,"name",e.target.value)} className="min-h-10 rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-sm text-white"/><label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={room.verified} onChange={(e)=>updateRoom(room.id,"verified",e.target.checked)}/> Field verified</label></div>
              <div className="mt-2 grid grid-cols-3 gap-2">{(["width","depth","height"] as const).map((key)=><label key={key} className="grid gap-1 text-[10px] uppercase tracking-wide text-zinc-500">{key} ft<input type="number" min="1" step="0.5" value={room[key]} onChange={(e)=>updateRoom(room.id,key,Math.max(1,Number(e.target.value)||1))} className="min-h-10 rounded-xl border border-[#2d7dff]/25 bg-black px-2 text-sm text-white"/></label>)}</div>
              {rooms.length > 1 ? <button type="button" onClick={()=>setRooms((r)=>r.filter((x)=>x.id!==room.id))} className="mt-2 inline-flex items-center gap-1 text-xs text-rose-300"><Trash2 className="h-3.5 w-3.5"/>Remove room</button> : null}
            </div>)}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={saveProject} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#8ffafa]/45 bg-[#2d7dff]/15 font-semibold text-white"><Save className="h-4 w-4"/>Save project</button><button type="button" onClick={exportSvg} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 bg-black font-semibold text-white"><Download className="h-4 w-4"/>Export blueprint</button></div>
          {message ? <p className="mt-3 rounded-xl border border-[#8ffafa]/20 bg-[#8ffafa]/5 px-3 py-2 text-xs text-[#d9fbff]">{message}</p> : null}
        </section>

        <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Live concept</p><h3 className="mt-1 text-lg font-semibold text-white">Isometric 3D blueprint</h3></div><span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">Field verify before construction</span></div>
          <div className="overflow-auto rounded-2xl border border-[#2d7dff]/20 bg-[#02060d] p-2">
            <svg ref={svgRef} viewBox="0 0 1100 760" xmlns="http://www.w3.org/2000/svg" className="min-h-[520px] w-full">
              <rect width="1100" height="760" fill="#02060d"/>
              <g stroke="#10294a" strokeWidth="1" opacity="0.45">{Array.from({length:22},(_,i)=><line key={`v${i}`} x1={i*50} y1="0" x2={i*50} y2="760"/>)}{Array.from({length:16},(_,i)=><line key={`h${i}`} x1="0" y1={i*50} x2="1100" y2={i*50}/>)}</g>
              {placements.map(({room,x,y}, index) => {
                const s = 10, ox = 470, oy = 215 + index * 2;
                const x0=x*s,y0=y*s,w=room.width*s,d=room.depth*s,h=room.height*7;
                const a=isoPoint(x0,y0,0), b=isoPoint(x0+w,y0,0), c=isoPoint(x0+w,y0+d,0), e=isoPoint(x0,y0+d,0);
                const at=isoPoint(x0,y0,h), bt=isoPoint(x0+w,y0,h), ct=isoPoint(x0+w,y0+d,h), et=isoPoint(x0,y0+d,h);
                const top=[at,bt,ct,et], left=[a,e,et,at], right=[b,c,ct,bt];
                const center=isoPoint(x0+w/2,y0+d/2,h+18);
                return <g key={room.id}>
                  <polygon points={pointsToString(left,ox,oy)} fill="rgba(45,125,255,.10)" stroke="#2d7dff" strokeWidth="2"/>
                  <polygon points={pointsToString(right,ox,oy)} fill="rgba(143,250,250,.07)" stroke="#8ffafa" strokeWidth="2"/>
                  <polygon points={pointsToString(top,ox,oy)} fill="rgba(8,20,38,.95)" stroke={room.verified?"#62f5b3":"#8ffafa"} strokeWidth="2.5"/>
                  <line x1={a[0]+ox} y1={a[1]+oy} x2={at[0]+ox} y2={at[1]+oy} stroke="#2d7dff" strokeWidth="2"/>
                  <line x1={c[0]+ox} y1={c[1]+oy} x2={ct[0]+ox} y2={ct[1]+oy} stroke="#2d7dff" strokeWidth="2"/>
                  <text x={center[0]+ox} y={center[1]+oy} fill="#e8fdff" fontSize="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700">{room.name}</text>
                  <text x={center[0]+ox} y={center[1]+oy+19} fill={room.verified?"#62f5b3":"#f6c85f"} fontSize="11" textAnchor="middle" fontFamily="Arial, sans-serif">{room.width}&apos; × {room.depth}&apos; × {room.height}&apos; · {room.verified?"VERIFIED":"UNVERIFIED"}</text>
                </g>;
              })}
              <text x="36" y="42" fill="#8ffafa" fontSize="18" fontFamily="Arial, sans-serif" fontWeight="700">CHILL BROS · PHOTO-ASSISTED 3D CONCEPT</text>
              <text x="36" y="66" fill="#6f8098" fontSize="12" fontFamily="Arial, sans-serif">Concept geometry only. Verify all dimensions, wall relationships, structure, utilities, code, and permitting in the field.</text>
            </svg>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-[#2d7dff]/15 bg-black/40 p-3"><p className="text-[10px] uppercase tracking-wide text-zinc-500">Source photos</p><p className="mt-1 text-lg font-semibold text-white">{files.length}</p></div><div className="rounded-xl border border-[#2d7dff]/15 bg-black/40 p-3"><p className="text-[10px] uppercase tracking-wide text-zinc-500">Rooms modeled</p><p className="mt-1 text-lg font-semibold text-white">{rooms.length}</p></div><div className="rounded-xl border border-[#2d7dff]/15 bg-black/40 p-3"><p className="text-[10px] uppercase tracking-wide text-zinc-500">Field verified</p><p className="mt-1 text-lg font-semibold text-white">{rooms.filter(r=>r.verified).length}/{rooms.length}</p></div></div>
        </section>
      </div>
    </div>
  );
}
