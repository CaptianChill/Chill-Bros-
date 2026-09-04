import { Box, Layers3, MonitorSmartphone, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { threeDAssets, type ThreeDAssetStatus } from "@/lib/chillbros/three-d-assets";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const statusLabel: Record<ThreeDAssetStatus, string> = {
  planned: "Planned",
  building: "Building",
  ready: "Ready",
};

export default async function ThreeDStudioPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");

  const building = threeDAssets.filter((asset) => asset.status === "building").length;
  const ready = threeDAssets.filter((asset) => asset.status === "ready").length;

  return (
    <AppShell
      title="3D Studio & Blender Pipeline"
      description="Build one reusable Chill Bros 3D library for branding, equipment training, vehicle visualization, proposals, and future interactive Chill Bro Bible diagnostics."
      highlight={
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">3D production</p>
          <StatusPill tone="emerald">{ready} web-ready assets</StatusPill>
          <StatusPill>{building} currently building</StatusPill>
          <StatusPill>{threeDAssets.length} tracked assets</StatusPill>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <SectionCard
          eyebrow="Blender asset library"
          title="Production queue"
          description="Every master model begins in Blender and exports to GLB for fast delivery inside the Chill Bros web app."
        >
          <div className="grid gap-3">
            {threeDAssets.map((asset) => (
              <article key={asset.id} className="rounded-2xl border border-[#2d7dff]/25 bg-black/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8ffafa]">{asset.category}</p>
                    <h3 className="mt-1 text-lg font-semibold text-white">{asset.name}</h3>
                  </div>
                  <StatusPill tone={asset.status === "ready" ? "emerald" : undefined}>{statusLabel[asset.status]}</StatusPill>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-300">{asset.purpose}</p>
                <dl className="mt-3 grid gap-2 text-xs text-zinc-400">
                  <div><dt className="inline text-[#d9fbff]">Blender source: </dt><dd className="inline break-all">{asset.source}</dd></div>
                  <div><dt className="inline text-[#d9fbff]">App export: </dt><dd className="inline break-all">{asset.webExport}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </SectionCard>

        <div className="grid gap-4">
          <SectionCard eyebrow="Standard pipeline" title="Blender → Chill Bros app" description="The same export rules keep assets consistent and mobile-friendly.">
            <ol className="space-y-3 text-sm leading-6 text-zinc-300">
              <li className="flex gap-3"><Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" /><span><strong className="text-white">1. Brand scene.</strong> Start from the Chill Bros master Blender scene with ice-blue neon, navy, chrome, and studio lighting.</span></li>
              <li className="flex gap-3"><Layers3 className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" /><span><strong className="text-white">2. Model cleanly.</strong> Name components by service function so future callouts can target contactors, motors, valves, boards, probes, and other parts.</span></li>
              <li className="flex gap-3"><Box className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" /><span><strong className="text-white">3. Export GLB.</strong> Keep Blender source files out of the web bundle and publish optimized GLB exports to <code className="text-[#d9fbff]">public/3d</code>.</span></li>
              <li className="flex gap-3"><MonitorSmartphone className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" /><span><strong className="text-white">4. Integrate.</strong> Use the optimized model in equipment records, training pages, proposals, and future interactive diagnostics.</span></li>
            </ol>
          </SectionCard>

          <SectionCard eyebrow="Phase 1" title="First production target" description="The first Blender asset is the reusable Chill Bros neon logo scene.">
            <div className="space-y-2 text-sm leading-6 text-zinc-300">
              <p>Output set: transparent PNG hero render, square app/social render, short looping logo animation, and optimized GLB.</p>
              <p>After the brand scene is stable, the commercial RTU becomes the first interactive equipment-training model.</p>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
