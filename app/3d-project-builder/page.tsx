import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Box, Eye, Images } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import PhotoBlueprintClient from "@/app/3d-studio/photo-blueprint/photo-blueprint-client";
import { ProjectBriefClient } from "./project-brief-client";

export const dynamic = "force-dynamic";

export default async function ThreeDProjectBuilderPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");

  return (
    <AppShell
      title="3D Project Builder"
      description="Standalone photo, measurements, customer changes, finished-product concept, and live walkthrough workflow."
      highlight={
        <div className="flex flex-wrap gap-2">
          <Link href="/3d-studio" className="inline-flex items-center gap-2 text-sm font-semibold text-[#d9fbff] underline underline-offset-4"><ArrowLeft className="h-4 w-4"/>3D Studio</Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#8ffafa]/25 bg-[#8ffafa]/5 px-3 py-1 text-xs text-[#d9fbff]"><Images className="h-3.5 w-3.5"/>Photos + measurements</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#2d7dff]/25 bg-[#2d7dff]/5 px-3 py-1 text-xs text-[#d9fbff]"><Box className="h-3.5 w-3.5"/>3D concept</span>
          <Link href="/3d-project-builder/walkthrough" className="inline-flex items-center gap-2 rounded-full border border-[#8ffafa]/45 bg-[#8ffafa]/10 px-3 py-1 text-xs font-semibold text-white"><Eye className="h-3.5 w-3.5"/>Live walkthrough</Link>
        </div>
      }
    >
      <div className="space-y-4">
        <ProjectBriefClient />
        <PhotoBlueprintClient />
        <section className="rounded-3xl border border-[#8ffafa]/30 bg-[#06111b]/85 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Live walkthrough</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">Save the project details and blueprint above, then open the walkthrough. It reads the same saved room dimensions, project address, finished-product target, and source photos from this builder.</p>
            </div>
            <Link href="/3d-project-builder/walkthrough" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#8ffafa]/55 bg-[#2d7dff]/20 px-4 font-semibold text-white"><Eye className="h-4 w-4"/>Open Live Walkthrough</Link>
          </div>
        </section>
        <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Output workflow</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">Use the saved project brief, source photos, verified measurements, blueprint, and walkthrough as the source package for the final presentation model. Photo-derived geometry remains a concept until dimensions and room relationships are field verified.</p>
        </section>
      </div>
    </AppShell>
  );
}
