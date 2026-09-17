import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ManagerUserPanel } from "@/components/manager-user-panel";
import { SectionCard } from "@/components/section-card";
import { getStaffAccounts } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const OWNER_EMAIL = "chillprostx@gmail.com";

export default async function OwnerAccessPage() {
  const profile = await getCurrentStaffProfile();
  const isOwner = profile?.role === "manager" && profile.email.trim().toLowerCase() === OWNER_EMAIL;

  if (!isOwner) redirect("/");

  const accounts = await getStaffAccounts();

  return (
    <AppShell title="Owner access for employee logins and staff administration.">
      <div className="space-y-4">
        <SectionCard
          eyebrow="Owner only"
          title="Employee logins & access"
          description="Add employee accounts, reset login credentials, and activate or deactivate staff without exposing these controls in the simplified daily workflow."
        >
          <ManagerUserPanel accounts={accounts} canManageCredentials />
        </SectionCard>
      </div>
    </AppShell>
  );
}
