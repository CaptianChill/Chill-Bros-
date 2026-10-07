import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { OpenFormDrafts } from "@/components/open-form-drafts";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

// One obvious place for anything typed but not saved yet (invoices, quotes, calls).
export default async function DraftsPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");

  return (
    <AppShell title="Drafts" description="Anything you started but did not save. Open one to pick up where you left off.">
      <div className="space-y-3">
        <OpenFormDrafts profileId={profile.id} />
      </div>
    </AppShell>
  );
}
