import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { PartsLookupForm } from "@/components/parts-lookup-form";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function PartsLookupPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (!["manager", "technician", "office"].includes(profile.role)) redirect("/");

  return <AppShell title="Parts Lookup" description="AI-assisted starting point for OEM part numbers by brand, model, and serial. Always verify before ordering.">
    <div className="mx-auto max-w-3xl space-y-4">
      <SectionCard title="Look up OEM parts">
        <PartsLookupForm />
      </SectionCard>
    </div>
  </AppShell>;
}
