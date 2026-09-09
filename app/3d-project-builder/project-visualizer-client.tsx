"use client";

import Link from "next/link";
import { useState } from "react";
import { Camera, Cuboid, ImageSparkles, Play, Save, Share2 } from "lucide-react";
import PhotoBlueprintClient from "@/app/3d-studio/photo-blueprint/photo-blueprint-client";
import { ProjectBriefClient } from "./project-brief-client";
import CompletedVisualClient from "./completed-visual-client";

const steps = [
  { id: "photos", n: "1", title: "Photos & Info", subtitle: "Upload · Details · Scope", icon: Camera },
  { id: "model", n: "2", title: "3D Model & Measurements", subtitle: "Build · Edit · Navigate", icon: Cuboid },
  { id: "finished", n: "3", title: "Completed Visual (AI)", subtitle: "Before / After · Walkthrough", icon: ImageSparkles },
] as const;

type StepId = (typeof steps)[number]["id"];

export default function ProjectVisualizerClient() {
  const [active, setActive] = useState<StepId>("photos");
  const [status, setStatus] = useState("");

  function saveAll() {
    window.dispatchEvent(new Event("chillbros:save-visualizer"));
    setStatus("Project save requested. Each section keeps its current project data on this device.");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-[#8ffafa]/30 bg-[#03101b]/95 p-3 shadow-[0_0_28px_rgba(45,125,255,.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8ffafa]">Chill Bros Project Visualizer</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Photos → measured model → customer-ready finished concept</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={saveAll} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#8ffafa]/35 bg-[#2d7dff]/12 px-3 text-xs font-semibold text-white"><Save className="h-4 w-4"/>Save project</button>
            <Link href="/3d-project-builder/walkthrough" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#8ffafa]/45 bg-[#8ffafa]/10 px-3 text-xs font-semibold text-white"><Play className="h-4 w-4"/>Walkthrough</Link>
            <button onClick={()=>navigator.share?.({title:"Chill Bros project visual",url:window.location.href})} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-xs font-semibold text-white"><Share2 className="h-4 w-4"/>Share</button>
          </div>
        </div>
        {status ? <p className="mt-2 text-xs text-[#d9fbff]">{status}</p> : null}
      </section>

      <div className="grid gap-2 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;
          const selected = active === step.id;
          return (
            <button key={step.id} onClick={()=>setActive(step.id)} className={`min-h-20 rounded-2xl border p-3 text-left transition ${selected ? "border-[#8ffafa]/70 bg-[#2d7dff]/18 shadow-[0_0_20px_rgba(143,250,250,.12)]" : "border-[#2d7dff]/20 bg-black/45 hover:border-[#8ffafa]/35"}`}>
              <div className="flex items-center gap-3">
                <span className={`grid h-10 w-10 place-items-center rounded-full border text-lg font-bold ${selected?"border-[#8ffafa] bg-[#8ffafa]/10 text-white":"border-[#2d7dff]/30 text-zinc-400"}`}>{step.n}</span>
                <div className="min-w-0"><p className="flex items-center gap-2 font-semibold text-white"><Icon className="h-4 w-4 text-[#8ffafa]"/>{step.title}</p><p className="mt-1 text-xs text-zinc-500">{step.subtitle}</p></div>
              </div>
            </button>
          );
        })}
      </div>

      {active === "photos" ? (
        <div className="space-y-4">
          <ProjectBriefClient />
          <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Photo intake</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Add the real house photos first</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Use the photo uploader in Step 2 to store the actual exterior and room photos with this project. Those same photos become the visual references for measurements, the concept model, and the finished AI render.</p>
            <button onClick={()=>setActive("model")} className="mt-3 rounded-xl border border-[#8ffafa]/35 bg-[#2d7dff]/12 px-4 py-2 text-sm font-semibold text-white">Add photos & measurements</button>
          </section>
        </div>
      ) : null}

      {active === "model" ? (
        <div className="space-y-4">
          <PhotoBlueprintClient />
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/3d-project-builder/walkthrough" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/45 bg-[#8ffafa]/10 px-4 font-semibold text-white"><Play className="h-4 w-4"/>Open movable walkthrough</Link>
            <button onClick={()=>setActive("finished")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/35 bg-[#2d7dff]/12 px-4 font-semibold text-white"><ImageSparkles className="h-4 w-4"/>Create finished visual</button>
          </div>
        </div>
      ) : null}

      {active === "finished" ? <CompletedVisualClient onBackToModel={()=>setActive("model")} /> : null}
    </div>
  );
}
