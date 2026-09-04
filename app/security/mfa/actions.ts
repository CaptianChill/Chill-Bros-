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

function normalizePhone(input: string) {
  const trimmed = String(input ?? "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return last4 ? `••• ••• ${last4}` : "your phone";
}

function smsErrorMessage(error: { message?: string; code?: string } | null) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  if (code.includes("provider") || message.includes("provider") || message.includes("sms")) {
    return "Text-message verification is not enabled for this Supabase project yet. The SMS provider must be configured before a code can be sent.";
  }
  if (message.includes("rate") || code.includes("rate")) return "Too many text-code requests. Wait a minute and try again.";
  if (message.includes("phone") || code.includes("phone")) return "That phone number could not be used for verification. Check the number and include the area code.";
  return "Could not send the verification text. Try again in a moment.";
}

export async function enrollManagerSmsAction(phoneInput: string): Promise<Result<{ factorId: string; challengeId: string; maskedPhone: string }>> {
  const guard = await requireManagerSession();
  if (!guard.ok) return guard;

  const phone = normalizePhone(phoneInput);
  if (!phone) return { ok: false, error: "Enter a valid mobile phone number with area code." };

  const { data: factors, error: listError } = await guard.auth.auth.mfa.listFactors();
  if (listError) return { ok: false, error: "Could not read verification status." };
  if (factors?.phone?.some((factor) => factor.status === "verified")) {
    return { ok: false, error: "A verified phone is already enrolled. Send a code to the enrolled phone instead." };
  }

  const enrollmentId = new Date().toISOString().replace(/[:.]/g, "-");
  const { data: enrollment, error: enrollError } = await guard.auth.auth.mfa.enroll({
    factorType: "phone",
    friendlyName: `Chill Bros Manager SMS ${enrollmentId}`,
    phone,
  });
  if (enrollError || !enrollment?.id) return { ok: false, error: smsErrorMessage(enrollError) };

  const { data: challenge, error: challengeError } = await guard.auth.auth.mfa.challenge({ factorId: enrollment.id });
  if (challengeError || !challenge?.id) {
    await guard.auth.auth.mfa.unenroll({ factorId: enrollment.id }).catch(() => undefined);
    return { ok: false, error: smsErrorMessage(challengeError) };
  }

  return { ok: true, data: { factorId: enrollment.id, challengeId: challenge.id, maskedPhone: maskPhone(phone) } };
}

export async function sendManagerSmsChallengeAction(factorId: string): Promise<Result<{ challengeId: string }>> {
  const guard = await requireManagerSession();
  if (!guard.ok) return guard;
  const cleanFactorId = String(factorId ?? "").trim();
  if (!UUID_PATTERN.test(cleanFactorId)) return { ok: false, error: "The enrolled phone factor is invalid." };

  const { data: factors, error: listError } = await guard.auth.auth.mfa.listFactors();
  if (listError) return { ok: false, error: "Could not read verification status." };
  const verifiedPhone = (factors?.phone ?? []).some((factor) => factor.id === cleanFactorId && factor.status === "verified");
  if (!verifiedPhone) return { ok: false, error: "The enrolled verification phone is not available." };

  const { data, error } = await guard.auth.auth.mfa.challenge({ factorId: cleanFactorId });
  if (error || !data?.id) return { ok: false, error: smsErrorMessage(error) };
  return { ok: true, data: { challengeId: data.id } };
}

export async function verifyManagerSmsAction(factorId: string, challengeId: string, code: string): Promise<Result> {
  const guard = await requireManagerSession();
  if (!guard.ok) return guard;
  const cleanFactorId = String(factorId ?? "").trim();
  const cleanChallengeId = String(challengeId ?? "").trim();
  const cleanCode = String(code ?? "").replace(/\D/g, "");
  if (!UUID_PATTERN.test(cleanFactorId) || !UUID_PATTERN.test(cleanChallengeId) || !/^\d{6}$/.test(cleanCode)) {
    return { ok: false, error: "Enter the 6-digit code from the text message." };
  }

  const { error } = await guard.auth.auth.mfa.verify({
    factorId: cleanFactorId,
    challengeId: cleanChallengeId,
    code: cleanCode,
  });
  if (error) return { ok: false, error: "That text-message code was not accepted. Request a new code and try again." };
  return { ok: true, data: undefined };
}

export async function signOutOtherManagerSessionsAction(): Promise<Result> {
  const guard = await requireManagerSession();
  if (!guard.ok) return guard;
  const { error } = await guard.auth.auth.signOut({ scope: "others" });
  if (error) return { ok: false, error: "Could not revoke other sessions." };
  return { ok: true, data: undefined };
}
