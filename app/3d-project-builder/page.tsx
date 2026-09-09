import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Box, Images } from "lucide-react";

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
      description="Standalone photo, measurements, customer changes, and finished-product concept workflow."
      highlight={
        <div className="flex flex-wrap gap-2">
          <Link href="/3d-studio" className="inline-flex items-center gap-2 text-sm font-semibold text-[#d9fbff] underline underline-offset-4"><ArrowLeft className="h-4 w-4"/>3D Studio</Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#8ffafa]/25 bg-[#8ffafa]/5 px-3 py-1 text-xs text-[#d9fbff]"><Images className="h-3.5 w-3.5"/>Photos + measurements</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#2d7dff]/25 bg-[#2d7dff]/5 px-3 py-1 text-xs text-[#d9fbff]"><Box className="h-3.5 w-3.5"/>3D concept</span>
        </div>
      }
    >
      <div className="space-y-4">
        <ProjectBriefClient />
        <PhotoBlueprintClient />
        <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Output workflow</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">Use the saved project brief, source photos, verified measurements, and blueprint as the source package for the final interactive walkthrough / presentation model. Photo-derived geometry remains a concept until dimensions and room relationships are field verified.</p>
        </section>
      </div>
    </AppShell>
  );
}
