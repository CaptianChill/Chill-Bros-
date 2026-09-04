"use server";

import { redirect } from "next/navigation";

import { checkLoginThrottle, recordLoginAttempt, safeInternalPath } from "@/lib/chillbros/security-guards";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export async function signInAction(_prevState: { error: string } | null, formData: FormData): Promise<{ error: string } | null> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = safeInternalPath(String(formData.get("next") || "/"));

  if (!email || !password || email.length > 320 || password.length > 512) {
    return { error: "Enter your email and password." };
  }

  const throttle = await checkLoginThrottle(email);
  if (!throttle.allowed) {
    return { error: "Too many sign-in attempts. Wait 15 minutes before trying again." };
  }

  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await recordLoginAttempt({ identityHash: throttle.identityHash, ipHash: throttle.ipHash, success: false }).catch(() => undefined);
    return { error: "Incorrect email or password." };
  }

  await recordLoginAttempt({ identityHash: throttle.identityHash, ipHash: throttle.ipHash, success: true }).catch(() => undefined);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    await supabase.auth.signOut();
    return { error: "Sign-in could not be verified." };
  }

  const service = createServiceRoleClient();
  const { data: profile } = await service
    .from("chillbros_profiles")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    return { error: "This staff account is not active." };
  }

  if (profile.role === "manager") {
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.currentLevel !== "aal2") {
      redirect(`/security/mfa?next=${encodeURIComponent(next)}`);
    }
  }

  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createAuthServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
