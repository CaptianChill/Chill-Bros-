import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";
import WalkthroughClient from "./walkthrough-client";

export const dynamic = "force-dynamic";

export default async function WalkthroughPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");

  return (
    <AppShell
      title="Live 3D Walkthrough"
      description="Walk room-by-room through the saved standalone 3D project concept."
      highlight={<Link href="/3d-project-builder" className="inline-flex items-center gap-2 text-sm font-semibold text-[#d9fbff] underline underline-offset-4"><ArrowLeft className="h-4 w-4"/>Back to 3D Project Builder</Link>}
    >
      <WalkthroughClient />
    </AppShell>
  );
}
