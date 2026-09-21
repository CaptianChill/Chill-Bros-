import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { PartsLookupForm } from "@/components/parts-lookup-form";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

export default async function PartsLookupPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (!["manager", "technician", "office"].includes(profile.role)) redirect("/");

  return <AppShell title="Parts Lookup" description="Search OEM parts, open manuals, and find the right parts desk by model and serial.">
    <div className="mx-auto max-w-4xl space-y-4">
      <SectionCard title="Parts research & manuals">
        <PartsLookupForm />
      </SectionCard>
    </div>
  </AppShell>;
}
