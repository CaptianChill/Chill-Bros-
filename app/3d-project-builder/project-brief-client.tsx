"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";

const STORAGE_KEY = "chillbros.3dProjectBrief.v1";

type Brief = {
  customer: string;
  address: string;
  projectTitle: string;
  requestedChanges: string;
  finishedProduct: string;
  fieldNotes: string;
};

const empty: Brief = {
  customer: "",
  address: "",
  projectTitle: "",
  requestedChanges: "",
  finishedProduct: "",
  fieldNotes: "",
};

export function ProjectBriefClient() {
  const [brief, setBrief] = useState<Brief>(empty);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Hydrating from localStorage can't run during SSR render (no `window`),
    // so this has to load post-mount and then setState once.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setBrief({ ...empty, ...JSON.parse(raw) });
    } catch {}
  }, []);

  function update(field: keyof Brief, value: string) {
    setBrief((current) => ({ ...current, [field]: value }));
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(brief));
    setMessage("Project brief saved on this device.");
  }

  const field = "min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600";

  return (
    <section className="rounded-3xl border border-[#8ffafa]/30 bg-[#06111b]/90 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8ffafa]">Standalone project</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Customer idea → photo model → finished concept</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Start a 3D concept without creating a service call first. Enter the property details, customer changes, and intended finished result, then use the photo blueprint builder below.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs text-zinc-400">Customer / project owner<input className={field} value={brief.customer} onChange={(e)=>update("customer", e.target.value)} placeholder="Customer or internal project" /></label>
        <label className="grid gap-1 text-xs text-zinc-400">Project title<input className={field} value={brief.projectTitle} onChange={(e)=>update("projectTitle", e.target.value)} placeholder="Kitchen remodel, HVAC layout..." /></label>
        <label className="grid gap-1 text-xs text-zinc-400 md:col-span-2">Property address<input className={field} value={brief.address} onChange={(e)=>update("address", e.target.value)} placeholder="Project address" /></label>
        <label className="grid gap-1 text-xs text-zinc-400 md:col-span-2">Customer requested changes<textarea className={`${field} min-h-24`} value={brief.requestedChanges} onChange={(e)=>update("requestedChanges", e.target.value)} placeholder="Walls moved, equipment locations, finishes, additions..." /></label>
        <label className="grid gap-1 text-xs text-zinc-400 md:col-span-2">Finished product / target result<textarea className={`${field} min-h-24`} value={brief.finishedProduct} onChange={(e)=>update("finishedProduct", e.target.value)} placeholder="Describe what the completed project should look like" /></label>
        <label className="grid gap-1 text-xs text-zinc-400 md:col-span-2">Field notes / known measurements<textarea className={`${field} min-h-20`} value={brief.fieldNotes} onChange={(e)=>update("fieldNotes", e.target.value)} placeholder="Known dimensions, doors, windows, ceiling heights, equipment clearances..." /></label>
      </div>

      <button type="button" onClick={save} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#8ffafa]/45 bg-[#2d7dff]/15 px-4 font-semibold text-white"><Save className="h-4 w-4"/>Save project details</button>
      {message ? <p className="mt-3 text-xs text-[#d9fbff]">{message}</p> : null}
    </section>
  );
}
