"use server";

import { redirect } from "next/navigation";

import { createAuthServerClient, getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export async function revokeOtherSessionsAction(): Promise<void> {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/sign-in?next=%2Fsecurity");

  const auth = await createAuthServerClient();
  const { error } = await auth.auth.signOut({ scope: "others" });
  if (error) redirect("/security?error=session-revoke");

  redirect("/security?revoked=1");
}
