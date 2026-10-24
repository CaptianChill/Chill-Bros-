"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { checkLoginThrottle, recordLoginAttempt, safeInternalPath } from "@/lib/chillbros/security-guards";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { isValidStaffPin, normalizeStaffName, staffCodeKey, staffLoginKey, staffPinKey } from "@/lib/auth/staff-login-key";
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
      return { step: "code", email, error: "You sign in with your name and PIN now. Tap \"Sign in with name + PIN\". Forgot your PIN? Ask Brae for a new one." };
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

export type StaffPinState = { error?: string; name?: string } | null;

const PIN_DAILY_FAILURE_LIMIT = 15;

/**
 * Staff sign in with their first and last name plus a 4-digit PIN.
 * Wrong PINs are throttled (5 per 15 minutes per name, plus a daily cap) so a
 * 4-digit PIN can't be guessed by trying them all.
 */
export async function pinSignInAction(_prev: StaffPinState, formData: FormData): Promise<StaffPinState> {
  const typedName = String(formData.get("name") || "").slice(0, 200);
  const pin = String(formData.get("pin") || "").trim();
  const next = safeInternalPath(String(formData.get("next") || "/"));
  const name = normalizeStaffName(typedName);

  if (!name || !name.includes(" ")) return { name: typedName, error: "Type your first and last name." };
  if (!isValidStaffPin(pin)) return { name: typedName, error: "Your PIN is 4 numbers." };

  const throttle = await checkLoginThrottle(`name:${name}`);
  if (!throttle.allowed) return { name: typedName, error: "Too many wrong PINs. Wait 15 minutes and try again." };

  const service = createServiceRoleClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dailyFailures } = await service
    .from("chillbros_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("identity_hash", throttle.identityHash)
    .eq("success", false)
    .gte("attempted_at", since);
  if ((dailyFailures ?? 0) >= PIN_DAILY_FAILURE_LIMIT) {
    return { name: typedName, error: "Too many wrong PINs today. Ask Brae to give you a new PIN." };
  }

  const fail = async (error: string): Promise<StaffPinState> => {
    await recordLoginAttempt({ identityHash: throttle.identityHash, ipHash: throttle.ipHash, success: false }).catch(() => undefined);
    return { name: typedName, error };
  };

  const { data: rows } = await service
    .from("chillbros_profiles")
    .select("id,full_name,email,auth_user_id,status")
    .eq("status", "active");
  const matches = (rows ?? []).filter((row) =>
    normalizeStaffName(String(row.full_name ?? "")) === name
    && String(row.email ?? "").trim().toLowerCase() !== OWNER_EMAIL
    && !String(row.email ?? "").endsWith("@removed.invalid"));

  // Same message whether the name or the PIN is wrong, so names can't be fished for.
  const wrong = "That name and PIN don't match. Check both and try again.";
  if (matches.length > 1) return { name: typedName, error: "Two staff accounts share that name. Ask Brae to fix it in the Owner screen." };
  const staff = matches[0];
  if (!staff) return fail(wrong);

  const email = String(staff.email).trim().toLowerCase();
  const signedIn = await auth.signIn.email({ email, password: staffPinKey(email, pin) }).catch(() => ({ data: null, error: { message: "sign-in failed" } }));
  if (signedIn.error) return fail(wrong);

  const userId = signedIn.data?.user?.id;
  if (!userId) {
    await auth.signOut().catch(() => undefined);
    return { name: typedName, error: "Sign-in couldn't be finished. Try again." };
  }
  if (staff.auth_user_id !== userId) {
    const { error: linkError } = await service.from("chillbros_profiles").update({ auth_user_id: userId }).eq("id", staff.id);
    if (linkError) {
      await auth.signOut().catch(() => undefined);
      return { name: typedName, error: "Your login couldn't be linked. Ask Brae for help." };
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
