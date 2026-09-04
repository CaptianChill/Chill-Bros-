"use server";

import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireManagerSession() {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in again to continue." };

  const service = createServiceRoleClient();
  const { data: profile } = await service
    .from("chillbros_profiles")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active" || profile.role !== "manager") {
    return { ok: false as const, error: "Manager access required." };
  }
  return { ok: true as const, auth };
}

export async function enrollManagerMfaAction(): Promise<Result<{ factorId: string; qrCode: string; secret: string }>> {
  const guard = await requireManagerSession();
  if (!guard.ok) return guard;

  const { data: factors, error: listError } = await guard.auth.auth.mfa.listFactors();
  if (listError) return { ok: false, error: "Could not read MFA status." };
  if (factors?.totp?.some((factor) => factor.status === "verified")) {
    return { ok: false, error: "An authenticator is already enrolled. Enter a code from it instead." };
  }

  // Supabase can retain an abandoned unverified enrollment without returning it
  // from listFactors(). Use a unique friendly name so a restart can never be
  // blocked by a stale factor-name conflict.
  const enrollmentId = new Date().toISOString().replace(/[:.]/g, "-");
  const { data, error } = await guard.auth.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Chill Bros Manager ${enrollmentId}`,
  });

  if (error || !data?.totp) {
    if (error?.code === "mfa_factor_name_conflict") {
      return { ok: false, error: "A previous authenticator setup is still pending. Refresh this page and start setup again." };
    }
    return { ok: false, error: "Could not start authenticator setup. Refresh the page and try once more." };
  }

  return {
    ok: true,
    data: {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    },
  };
}

export async function verifyManagerMfaAction(factorId: string, code: string): Promise<Result> {
  const guard = await requireManagerSession();
  if (!guard.ok) return guard;
  const cleanFactorId = String(factorId ?? "").trim();
  const cleanCode = String(code ?? "").replace(/\s/g, "");
  if (!UUID_PATTERN.test(cleanFactorId) || !/^\d{6}$/.test(cleanCode)) {
    return { ok: false, error: "Enter the 6-digit authenticator code." };
  }

  // Supabase binds MFA challenges to the current authenticated user. Do not
  // pre-filter through listFactors(), because pending/unverified TOTP factors
  // can be omitted there before the first successful verification.
  const { error } = await guard.auth.auth.mfa.challengeAndVerify({ factorId: cleanFactorId, code: cleanCode });
  if (error) return { ok: false, error: "That authenticator code was not accepted. Check the phone time and try the newest code." };
  return { ok: true, data: undefined };
}

export async function signOutOtherManagerSessionsAction(): Promise<Result> {
  const guard = await requireManagerSession();
  if (!guard.ok) return guard;
  const { error } = await guard.auth.auth.signOut({ scope: "others" });
  if (error) return { ok: false, error: "Could not revoke other sessions." };
  return { ok: true, data: undefined };
}
