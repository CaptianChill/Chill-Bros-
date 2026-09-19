import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";
import ProjectVisualizerClient from "./project-visualizer-client";

export const dynamic = "force-dynamic";

export default async function ThreeDProjectBuilderPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");

  return (
    <AppShell
      title="3D Project Builder"
      description="Standalone renovation visualizer for real property photos, measurements, movable walkthroughs, and photorealistic completed-project concepts."
      highlight={
        <div className="flex flex-wrap gap-2">
          <Link href="/3d-studio" className="inline-flex items-center gap-2 text-sm font-semibold text-[#d9fbff] underline underline-offset-4"><ArrowLeft className="h-4 w-4"/>3D Studio</Link>
          <Link href="/3d-project-builder/walkthrough" className="inline-flex items-center gap-2 rounded-full border border-[#8ffafa]/45 bg-[#8ffafa]/10 px-3 py-1 text-xs font-semibold text-white"><Eye className="h-3.5 w-3.5"/>Movable walkthrough</Link>
        </div>
      }
    >
      <ProjectVisualizerClient />
    </AppShell>
  );
}
