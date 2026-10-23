"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { checkLoginThrottle, recordLoginAttempt, safeInternalPath } from "@/lib/chillbros/security-guards";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { staffCodeKey, staffLoginKey } from "@/lib/auth/staff-login-key";
import { createLoginCode, normalizeEmail, verifyLoginCode } from "@/lib/chillbros/customer-account";
import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";

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

  const { data: signedIn, error } = await auth.signIn.email({ email, password });
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

  const authUserId = signedIn?.user?.id;
  if (!authUserId) {
    await auth.signOut().catch(() => undefined);
    return { error: "This staff login could not be verified." };
  }

  const service = createServiceRoleClient();
  const { data: profile } = await service
    .from("chillbros_profiles")
    .select("role,status")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    await auth.signOut().catch(() => undefined);
    return { error: "This staff account is not active." };
  }

  await recordLoginAttempt({ identityHash: throttle.identityHash, ipHash: throttle.ipHash, success: true }).catch(() => undefined);
  redirect(next);
}

export type StaffCodeState =
  | { step: "email"; error?: string; email?: string }
  | { step: "code"; email: string; error?: string; message?: string }
  | { step: "password"; email: string; error?: string };

async function findActiveStaff(email: string) {
  const service = createServiceRoleClient();
  const { data } = await service
    .from("chillbros_profiles")
    .select("id,full_name,auth_user_id,status,email")
    .ilike("email", email)
    .neq("status", "inactive")
    .limit(2);
  const rows = (data ?? []).filter((row) => String(row.email).trim().toLowerCase() === email && row.status === "active");
  return rows.length === 1 ? rows[0] : null;
}

/** Step 1: the employee enters only their email; a 6-digit code is emailed to them. */
export async function requestStaffCodeAction(_prev: StaffCodeState | null, formData: FormData): Promise<StaffCodeState> {
  const email = normalizeEmail(String(formData.get("email") || ""));
  if (!email) return { step: "email", error: "Enter your work email." };
  if (email === OWNER_EMAIL) return { step: "password", email };

  const staff = await findActiveStaff(email);
  if (!staff) return { step: "email", email, error: "That email isn't set up for staff sign-in. Ask Brae to add you in the Owner screen." };

  let code: string | null;
  try {
    code = await createLoginCode(staffCodeKey(email));
  } catch {
    return { step: "email", email, error: "Couldn't create a code right now. Try again in a minute." };
  }
  if (!code) return { step: "email", email, error: "Too many codes requested. Wait an hour, or ask Brae for help." };

  const text = `Your Chill Pros staff sign-in code is ${code}\n\nEnter it on the sign-in screen. It expires in 10 minutes.\n\nIf you didn't ask for this, you can ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#0A1A33"><p style="margin:0 0 8px;font-size:15px">Your Chill Pros staff sign-in code:</p><p style="margin:0 0 16px;font-size:34px;font-weight:700;letter-spacing:6px">${code}</p><p style="margin:0;color:#3D5170;font-size:14px">It expires in 10 minutes. If you didn't ask for this, you can ignore this email.</p></div>`;
  const sent = await sendCompanyEmail(email, `Chill Pros sign-in code: ${code}`, text, html).catch(() => ({ status: "failed" as const }));
  if (sent.status !== "sent") return { step: "email", email, error: "We couldn't send the code. Try again, or text Brae." };
  return { step: "code", email, message: `Code sent to ${email}. Check your inbox (and spam).` };
}

/** Step 2: the emailed code proves the email; open the staff session without any password. */
export async function verifyStaffCodeAction(_prev: StaffCodeState | null, formData: FormData): Promise<StaffCodeState> {
  const email = normalizeEmail(String(formData.get("email") || ""));
  const code = String(formData.get("code") || "");
  const next = safeInternalPath(String(formData.get("next") || "/"));
  if (!email) return { step: "email", error: "Enter your work email." };
  if (email === OWNER_EMAIL) return { step: "password", email };

  const throttle = await checkLoginThrottle(email);
  if (!throttle.allowed) return { step: "code", email, error: "Too many tries. Wait 15 minutes, then request a new code." };

  const check = await verifyLoginCode(staffCodeKey(email), code);
  if (check !== "ok") {
    await recordLoginAttempt({ identityHash: throttle.identityHash, ipHash: throttle.ipHash, success: false }).catch(() => undefined);
    const error = check === "invalid" ? "That code isn't right. Check the email and try again."
      : check === "locked" ? "Too many wrong codes. Tap \"Send a new code\"."
      : "That code expired. Tap \"Send a new code\".";
    return { step: "code", email, error };
  }

  const staff = await findActiveStaff(email);
  if (!staff) return { step: "email", email, error: "This staff account is not active. Ask Brae." };

  const password = staffLoginKey(email);
  let userId: string | undefined;
  const signedIn = await auth.signIn.email({ email, password }).catch(() => ({ data: null, error: { message: "sign-in failed" } }));
  if (!signedIn.error) {
    userId = signedIn.data?.user?.id;
  } else {
    // No Neon login yet for this employee: create it with the server-held key.
    const signedUp = await auth.signUp.email({ email, password, name: staff.full_name || email }).catch(() => ({ data: null, error: { message: "sign-up failed" } }));
    if (signedUp.error) {
      return { step: "code", email, error: "Your login needs a one-time switch. Ask Brae to tap \"Turn on email sign-in\" next to your name in the Owner screen, then try again." };
    }
    userId = signedUp.data?.user?.id;
  }
  if (!userId) {
    await auth.signOut().catch(() => undefined);
    return { step: "code", email, error: "Sign-in couldn't be finished. Ask Brae to tap \"Turn on email sign-in\" for you." };
  }

  if (staff.auth_user_id !== userId) {
    const service = createServiceRoleClient();
    const { error: linkError } = await service.from("chillbros_profiles").update({ auth_user_id: userId }).eq("id", staff.id).eq("email", staff.email);
    if (linkError) {
      await auth.signOut().catch(() => undefined);
      return { step: "code", email, error: "Your login couldn't be linked. Ask Brae for help." };
    }
  }

  await recordLoginAttempt({ identityHash: throttle.identityHash, ipHash: throttle.ipHash, success: true }).catch(() => undefined);
  redirect(next);
}

/** One entry point for the staff screen: intent=request sends a code, intent=verify signs in. */
export async function staffCodeAction(prev: StaffCodeState | null, formData: FormData): Promise<StaffCodeState> {
  return String(formData.get("intent")) === "verify" ? verifyStaffCodeAction(prev, formData) : requestStaffCodeAction(prev, formData);
}

export async function signOutAction(): Promise<void> {
  await auth.signOut().catch(() => undefined);
  redirect("/sign-in");
}
