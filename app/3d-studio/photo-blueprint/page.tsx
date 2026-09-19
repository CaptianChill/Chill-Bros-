import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import PhotoBlueprintClient from "./photo-blueprint-client";

export const dynamic = "force-dynamic";

export default async function PhotoBlueprintPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");

  return (
    <AppShell
      title="Photo → 3D Blueprint"
      description="Turn field photos and working dimensions into a saved, field-verifiable 3D concept blueprint."
      highlight={
        <Link href="/3d-studio" className="inline-flex items-center gap-2 text-sm font-semibold text-[#d9fbff] underline underline-offset-4">
          <ArrowLeft className="h-4 w-4" /> Back to 3D Studio
        </Link>
      }
    >
      <PhotoBlueprintClient />
    </AppShell>
  );
}
