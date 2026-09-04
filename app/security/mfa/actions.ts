"use server";

import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

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

  // Clear abandoned unverified enrollment attempts so the manager can restart setup cleanly.
  for (const factor of factors?.totp ?? []) {
    if (factor.status !== "verified") await guard.auth.auth.mfa.unenroll({ factorId: factor.id }).catch(() => undefined);
  }

  const { data, error } = await guard.auth.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Chill Bros Manager",
  });
  if (error || !data?.totp) return { ok: false, error: "Could not start authenticator setup." };

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
  if (!cleanFactorId || !/^\d{6}$/.test(cleanCode)) return { ok: false, error: "Enter the 6-digit authenticator code." };

  const { data: factors, error: listError } = await guard.auth.auth.mfa.listFactors();
  if (listError) return { ok: false, error: "Could not verify the authenticator factor." };
  const ownsFactor = (factors?.totp ?? []).some((factor) => factor.id === cleanFactorId);
  if (!ownsFactor) return { ok: false, error: "Authenticator factor is not available for this account." };

  const { error } = await guard.auth.auth.mfa.challengeAndVerify({ factorId: cleanFactorId, code: cleanCode });
  if (error) return { ok: false, error: "That authenticator code was not accepted." };
  return { ok: true, data: undefined };
}

export async function signOutOtherManagerSessionsAction(): Promise<Result> {
  const guard = await requireManagerSession();
  if (!guard.ok) return guard;
  const { error } = await guard.auth.auth.signOut({ scope: "others" });
  if (error) return { ok: false, error: "Could not revoke other sessions." };
  return { ok: true, data: undefined };
}
