import Link from "next/link";
import { ArrowLeft, Box, CheckCircle2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { ThreeDAssetViewer } from "@/components/three-d-asset-viewer";
import { threeDAssets } from "@/lib/chillbros/three-d-assets";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function ThreeDAssetViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");

  const { id } = await params;
  const asset = threeDAssets.find((item) => item.id === id);
  if (!asset) notFound();

  const src = `/${asset.webExport.replace(/^public\//, "")}`;

  return (
    <AppShell
      title={asset.name}
      description="Interactive Blender export preview from the Chill Bros 3D asset library."
      highlight={
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">3D asset preview</p>
          <StatusPill tone={asset.status === "ready" ? "emerald" : undefined}>{asset.status === "ready" ? "Ready" : asset.status}</StatusPill>
          <StatusPill>{asset.progress}% pipeline progress</StatusPill>
        </div>
      }
    >
      <div className="space-y-4">
        <Link href="/3d-studio" className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 bg-black/30 px-4 py-2 text-sm font-semibold text-white hover:border-[#8ffafa]/45">
          <ArrowLeft className="h-4 w-4" />Back to 3D Studio
        </Link>

        {asset.status === "ready" ? (
          <ThreeDAssetViewer src={src} label={asset.name} />
        ) : (
          <SectionCard eyebrow="Not ready" title="This asset is still in the Blender pipeline" description="The viewer unlocks automatically after the GLB export passes validation.">
            <p className="text-sm text-zinc-400">Current status: {asset.status} · {asset.progress}%</p>
          </SectionCard>
        )}

        <SectionCard eyebrow={asset.category} title="Asset details" description={asset.purpose}>
          <div className="grid gap-3 text-sm leading-6 text-zinc-300 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/25 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-[#8ffafa]">Web export</p><p className="mt-2 break-all">{asset.webExport}</p></div>
            <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/25 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-[#8ffafa]">Build status</p><p className="mt-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#8ffafa]" />{asset.status === "ready" ? "Validated Blender GLB" : "Waiting for Blender export"}</p></div>
            <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/25 p-4 sm:col-span-2"><p className="text-[10px] uppercase tracking-[0.16em] text-[#8ffafa]">Source</p><p className="mt-2 flex items-start gap-2 break-all"><Box className="mt-1 h-4 w-4 shrink-0 text-[#8ffafa]" />{asset.source}</p></div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
