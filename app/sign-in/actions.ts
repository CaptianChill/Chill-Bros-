"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { checkLoginThrottle, recordLoginAttempt, safeInternalPath } from "@/lib/chillbros/security-guards";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

const OWNER_EMAIL = "chillprostx@gmail.com";

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

  const { error } = await auth.signIn.email({ email, password });
  if (error) {
    await recordLoginAttempt({ identityHash: throttle.identityHash, ipHash: throttle.ipHash, success: false }).catch(() => undefined);
    return { error: "Incorrect email or password." };
  }

  // Do not call auth.getSession() in the same server action that just set the
  // Neon Auth cookie. The request cookie snapshot can lag the newly written
  // cookie and falsely report that sign-in could not be verified. The next
  // request is protected by Neon Auth middleware, which validates the fresh
  // session before any protected page is served.
  if (email === OWNER_EMAIL) {
    await recordLoginAttempt({ identityHash: throttle.identityHash, ipHash: throttle.ipHash, success: true }).catch(() => undefined);
    redirect(next);
  }

  // Temporary compatibility path for remaining staff until their operational
  // profiles are moved off the legacy service client.
  const service = createServiceRoleClient();
  const { data: profile } = await service
    .from("chillbros_profiles")
    .select("role,status")
    .ilike("email", email)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    await auth.signOut().catch(() => undefined);
    return { error: "This staff account is not active." };
  }

  await recordLoginAttempt({ identityHash: throttle.identityHash, ipHash: throttle.ipHash, success: true }).catch(() => undefined);
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  await auth.signOut().catch(() => undefined);
  redirect("/sign-in");
}
