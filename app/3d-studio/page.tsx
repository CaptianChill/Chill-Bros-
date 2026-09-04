import Link from "next/link";
import { Box, CheckCircle2, Layers3, MonitorSmartphone, Rotate3D, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { threeDAssets, type ThreeDAssetStatus } from "@/lib/chillbros/three-d-assets";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const statusLabel: Record<ThreeDAssetStatus, string> = {
  blocked: "Blocked",
  queued: "Queued",
  building: "Building",
  ready: "Ready",
};

export default async function ThreeDStudioPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");

  const ready = threeDAssets.filter((asset) => asset.status === "ready").length;
  const queued = threeDAssets.filter((asset) => asset.status === "queued").length;
  const trainingReady = threeDAssets.filter((asset) => asset.modelSlug && asset.status === "ready").length;
  const overallProgress = Math.round(threeDAssets.reduce((sum, asset) => sum + asset.progress, 0) / Math.max(threeDAssets.length, 1));

  return (
    <AppShell
      title="3D Studio & Blender Pipeline"
      description="Real Blender build status for reusable Chill Bros brand, equipment, training, and fleet assets. No permanent placeholder progress."
      highlight={
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">3D production</p>
          <StatusPill tone={ready === threeDAssets.length ? "emerald" : undefined}>{overallProgress}% overall pipeline</StatusPill>
          <StatusPill tone={ready ? "emerald" : undefined}>{ready} of {threeDAssets.length} Blender exports ready</StatusPill>
          <StatusPill>{queued} queued for automated build</StatusPill>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <SectionCard eyebrow="Blender asset library" title="Production queue" description="Status now comes from the generated Blender manifest. An asset reaches Ready only after a real GLB export is created by the build pipeline.">
          <div className="grid gap-3">
            {threeDAssets.map((asset) => (
              <article key={asset.id} className="rounded-2xl border border-[#2d7dff]/25 bg-black/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8ffafa]">{asset.category}</p>
                    <h3 className="mt-1 break-words text-lg font-semibold text-white">{asset.name}</h3>
                  </div>
                  <StatusPill tone={asset.status === "ready" ? "emerald" : undefined}>{statusLabel[asset.status]}</StatusPill>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-zinc-500"><span>Pipeline progress</span><span className="text-[#d9fbff]">{asset.progress}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full border border-[#2d7dff]/20 bg-[#020407]"><div className="h-full rounded-full bg-[#2d7dff] shadow-[0_0_10px_rgba(143,250,250,0.45)] transition-all" style={{ width: `${asset.progress}%` }} /></div>
                </div>

                <p className="mt-3 text-sm leading-6 text-zinc-300">{asset.purpose}</p>
                <div className="mt-3 rounded-xl border border-[#2d7dff]/20 bg-[#07152c]/35 p-3 text-xs leading-5 text-zinc-300"><strong className="text-[#d9fbff]">Next: </strong>{asset.nextStep}</div>
                <dl className="mt-3 grid gap-2 text-xs text-zinc-400">
                  <div><dt className="inline text-[#d9fbff]">Blender source: </dt><dd className="inline break-all">{asset.source}</dd></div>
                  <div><dt className="inline text-[#d9fbff]">App export: </dt><dd className="inline break-all">{asset.webExport}</dd></div>
                  {asset.builtAt ? <div><dt className="inline text-[#d9fbff]">Built: </dt><dd className="inline">{new Date(asset.builtAt).toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</dd></div> : null}
                </dl>
              </article>
            ))}
          </div>
        </SectionCard>

        <div className="grid gap-4">
          <SectionCard eyebrow="Live in the app" title="Interactive training layer" description="RTU, reach-in refrigeration, ice-machine, and fryer training models keep their current schematic fallback until each Blender GLB is actually generated.">
            <div className="space-y-3 text-sm leading-6 text-zinc-300">
              <p className="flex gap-3"><Rotate3D className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" />{trainingReady} of 4 training families are currently using Blender exports. The rest stay on the working service schematic instead of showing a broken model.</p>
              <p className="flex gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" />When the automated Blender job creates a GLB, the viewer switches to that asset without rewriting the Chill Bros Bible case.</p>
              <Link href="/training" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 px-4 py-3 font-medium text-white transition hover:bg-[#2d7dff]/20"><MonitorSmartphone className="h-4 w-4" />Open Training Center</Link>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Automated pipeline" title="Blender → GitHub → Vercel → Chill Bros" description="The pipeline runs headless Blender from the repository so the app no longer depends on somebody remembering to update a status badge.">
            <ol className="space-y-3 text-sm leading-6 text-zinc-300">
              <li className="flex gap-3"><Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" /><span><strong className="text-white">1. Build.</strong> Blender creates the branded sign, RTU, reach-in, ice machine, fryer, and service-vehicle training assets.</span></li>
              <li className="flex gap-3"><Layers3 className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" /><span><strong className="text-white">2. Record.</strong> The generated manifest records exactly which GLBs finished successfully.</span></li>
              <li className="flex gap-3"><Box className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" /><span><strong className="text-white">3. Publish.</strong> Optimized GLBs are committed to the app and Vercel deploys them with the normal Git workflow.</span></li>
              <li className="flex gap-3"><MonitorSmartphone className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" /><span><strong className="text-white">4. Use.</strong> The Training Center automatically prefers the Blender model and keeps the existing schematic as a fallback.</span></li>
            </ol>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
