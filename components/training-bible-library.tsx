"use client";

import { useMemo, useState } from "react";
import { Box, Search, ShieldAlert, Wrench } from "lucide-react";

import type { TrainingCase } from "@/lib/chillbros/training-cases";

export function TrainingBibleLibrary({ cases }: { cases: TrainingCase[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedId, setSelectedId] = useState(cases[0]?.id ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((item) => {
      const categoryMatch = category === "All" || item.category === category;
      if (!q) return categoryMatch;
      const haystack = [item.title, item.category, item.equipment, item.diagnosis, ...item.symptoms, ...item.readings, ...item.tags, ...item.components].join(" ").toLowerCase();
      return categoryMatch && haystack.includes(q);
    });
  }, [cases, category, query]);

  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? cases[0];
  const categories = ["All", ...Array.from(new Set(cases.map((item) => item.category)))];

  if (!selected) return null;

  return (
    <div className="grid w-full min-w-0 gap-4 overflow-x-hidden xl:grid-cols-[0.78fr_1.22fr]">
      <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-[#2d7dff]/30 bg-black/30 p-4 sm:p-5">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-[#8ffafa]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search symptom, reading, component, code..." className="w-full min-w-0 rounded-xl border border-[#2d7dff]/30 bg-[#020407] py-3 pl-10 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#8ffafa]/60" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {categories.map((item, index) => {
            const spanLastMobileRow = categories.length % 2 === 1 && index === categories.length - 1;
            return <button key={item} onClick={() => setCategory(item)} className={`${spanLastMobileRow ? "col-span-2" : ""} min-h-10 w-full min-w-0 rounded-xl border px-3 py-2 text-center text-xs leading-tight transition sm:w-auto sm:min-h-0 sm:rounded-full sm:py-1.5 ${category === item ? "border-[#8ffafa]/70 bg-[#2d7dff]/15 text-white" : "border-[#2d7dff]/25 text-zinc-400"}`}>{item}</button>;
          })}
        </div>
        <div className="mt-4 grid w-full min-w-0 gap-2">
          {filtered.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full min-w-0 rounded-xl border p-3 text-left transition ${selected.id === item.id ? "border-[#8ffafa]/55 bg-[#2d7dff]/12" : "border-[#2d7dff]/20 bg-black/20 hover:border-[#2d7dff]/45"}`}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">{item.category}</p><p className="mt-1 break-words text-sm font-semibold text-white">{item.title}</p><p className="mt-1 break-words text-xs leading-5 text-zinc-500">{item.equipment}</p></button>)}
          {filtered.length === 0 ? <p className="w-full rounded-xl border border-[#2d7dff]/20 p-4 text-sm text-zinc-500">No matching Bible case yet. That becomes a candidate for a future field-case entry.</p> : null}
        </div>
      </section>

      <section className="min-w-0 space-y-4">
        <div className="w-full min-w-0 rounded-2xl border border-[#2d7dff]/35 bg-gradient-to-br from-[#2d7dff]/10 via-black/30 to-black/40 p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8ffafa]">Page from the Chill Bro Bible</p>
          <h2 className="mt-2 break-words text-xl font-semibold text-white sm:text-2xl">{selected.title}</h2>
          <p className="mt-2 break-words text-sm leading-6 text-zinc-300">{selected.diagnosis}</p>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <BibleList title="Symptoms" items={selected.symptoms} />
          <BibleList title="Readings / checks" items={selected.readings} />
        </div>

        <div className="w-full min-w-0 rounded-2xl border border-[#2d7dff]/30 bg-black/30 p-4 sm:p-5">
          <div className="flex items-center gap-2"><Box className="h-4 w-4 text-[#8ffafa]" /><h3 className="font-semibold text-white">3D component walkthrough</h3></div>
          <p className="mt-2 break-words text-sm leading-6 text-zinc-400">This training view is already mapped to the component names our Blender models will use. As each GLB model is added, these component cards become clickable highlights on the real 3D equipment model.</p>
          <div className="mt-4 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
            {selected.components.map((component, index) => <div key={component} className="group relative min-h-24 min-w-0 overflow-hidden rounded-xl border border-[#2d7dff]/30 bg-gradient-to-br from-[#0b1b39] to-[#020407] p-3 shadow-[inset_0_0_18px_rgba(45,125,255,0.08)]"><div className="absolute right-2 top-2 h-7 w-7 rotate-12 rounded border border-[#8ffafa]/25 bg-[#2d7dff]/10 shadow-[6px_6px_0_rgba(45,125,255,0.08)]" /><p className="relative text-[10px] uppercase tracking-[0.16em] text-[#8ffafa]">Component {index + 1}</p><p className="relative mt-4 break-words text-sm font-semibold text-white">{component}</p></div>)}
          </div>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <BibleList title="Likely causes" items={selected.likelyCauses} icon="wrench" />
          <BibleList title="Diagnostic sequence" items={selected.steps} numbered />
        </div>

        <div className="w-full min-w-0 rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4">
          <div className="flex items-center gap-2 text-amber-100"><ShieldAlert className="h-4 w-4" /><h3 className="font-semibold">Safety / field note</h3></div>
          <p className="mt-2 break-words text-sm leading-6 text-zinc-300">{selected.safety}</p>
        </div>
      </section>
    </div>
  );
}

function BibleList({ title, items, numbered = false, icon }: { title: string; items: string[]; numbered?: boolean; icon?: "wrench" }) {
  return <div className="w-full min-w-0 rounded-2xl border border-[#2d7dff]/25 bg-black/25 p-4"><div className="flex items-center gap-2">{icon === "wrench" ? <Wrench className="h-4 w-4 text-[#8ffafa]" /> : null}<h3 className="font-semibold text-white">{title}</h3></div><ol className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">{items.map((item, index) => <li key={`${title}-${index}`} className="flex min-w-0 gap-2"><span className="w-5 shrink-0 text-[#8ffafa]">{numbered ? `${index + 1}.` : "•"}</span><span className="min-w-0 break-words">{item}</span></li>)}</ol></div>;
}
