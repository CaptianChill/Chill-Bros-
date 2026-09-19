import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ScanSendTool } from "@/components/scan-send-tool";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function ScanSendPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in?next=/scan-send");

  return (
    <AppShell title="Scan & Send" description="Photograph paperwork, combine the pages into one PDF, and email it directly from the Chill Bros app.">
      <ScanSendTool defaultRecipient={(process.env.SCAN_DEFAULT_TO || "").trim()} />
    </AppShell>
  );
}
