import Link from "next/link";
import { Box, Layers3, MonitorSmartphone, Rotate3D, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { threeDAssets, type ThreeDAssetStatus } from "@/lib/chillbros/three-d-assets";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const statusLabel: Record<ThreeDAssetStatus, string> = { planned: "Planned", building: "Building", ready: "Ready" };

export default async function ThreeDStudioPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");

  const building = threeDAssets.filter((asset) => asset.status === "building").length;
  const ready = threeDAssets.filter((asset) => asset.status === "ready").length;

  return (
    <AppShell
      title="3D Studio & Blender Pipeline"
      description="Manage the production-quality Blender asset library while the Training Center uses lightweight interactive service schematics today."
      highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">3D production</p><StatusPill tone="emerald">4 training models live</StatusPill><StatusPill>{ready} Blender exports ready</StatusPill><StatusPill>{building} currently building</StatusPill></div>}
    >
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <SectionCard eyebrow="Blender asset library" title="Production queue" description="Blender remains the source for detailed, reusable production models. The web training schematics provide an immediate interactive baseline while those assets are built.">
          <div className="grid gap-3">
            {threeDAssets.map((asset) => (
              <article key={asset.id} className="rounded-2xl border border-[#2d7dff]/25 bg-black/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8ffafa]">{asset.category}</p><h3 className="mt-1 text-lg font-semibold text-white">{asset.name}</h3></div><StatusPill tone={asset.status === "ready" ? "emerald" : undefined}>{statusLabel[asset.status]}</StatusPill></div>
                <p className="mt-3 text-sm leading-6 text-zinc-300">{asset.purpose}</p>
                <dl className="mt-3 grid gap-2 text-xs text-zinc-400"><div><dt className="inline text-[#d9fbff]">Blender source: </dt><dd className="inline break-all">{asset.source}</dd></div><div><dt className="inline text-[#d9fbff]">App export: </dt><dd className="inline break-all">{asset.webExport}</dd></div></dl>
              </article>
            ))}
          </div>
        </SectionCard>

        <div className="grid gap-4">
          <SectionCard eyebrow="Live in the app" title="Interactive training layer" description="RTU, reach-in refrigeration, ice-machine, and fryer schematic models now open in a full-screen rotatable viewer from the Chill Bros Bible.">
            <div className="space-y-3 text-sm leading-6 text-zinc-300">
              <p className="flex gap-3"><Rotate3D className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" />The current models are generic service-training geometry, clearly labeled so nobody mistakes them for an OEM drawing.</p>
              <Link href="/training" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 px-4 py-3 font-medium text-white transition hover:bg-[#2d7dff]/20"><MonitorSmartphone className="h-4 w-4" />Open Training Center</Link>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Standard pipeline" title="Blender → Chill Bros app" description="The same export rules keep future production assets consistent and mobile-friendly.">
            <ol className="space-y-3 text-sm leading-6 text-zinc-300">
              <li className="flex gap-3"><Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" /><span><strong className="text-white">1. Brand scene.</strong> Start from the Chill Bros master Blender scene with ice-blue neon, navy, chrome, and studio lighting.</span></li>
              <li className="flex gap-3"><Layers3 className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" /><span><strong className="text-white">2. Model cleanly.</strong> Keep service components separate and consistently named.</span></li>
              <li className="flex gap-3"><Box className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" /><span><strong className="text-white">3. Export GLB.</strong> Publish optimized GLB assets rather than shipping heavy working Blender files to phones.</span></li>
              <li className="flex gap-3"><MonitorSmartphone className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" /><span><strong className="text-white">4. Replace schematic.</strong> Detailed Blender exports can drop into the existing viewer as each equipment family is approved.</span></li>
            </ol>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
