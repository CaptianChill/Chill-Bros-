import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const IDENTITY_FAILURE_LIMIT = 5;
const IP_FAILURE_LIMIT = 20;

function digest(value: string) {
  return createHash("sha256").update(`chillbros-security-v1|${value}`).digest("hex");
}

export function safeInternalPath(value: string | null | undefined, fallback = "/") {
  const candidate = String(value ?? "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;
  try {
    const parsed = new URL(candidate, "https://chill-bros.invalid");
    if (parsed.origin !== "https://chill-bros.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

async function loginFingerprints(email: string) {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || requestHeaders.get("x-real-ip")?.trim() || "unknown";
  const normalizedEmail = email.trim().toLowerCase();
  return {
    identityHash: digest(normalizedEmail),
    ipHash: digest(ip),
  };
}

export async function checkLoginThrottle(email: string): Promise<{ allowed: true; identityHash: string; ipHash: string } | { allowed: false }> {
  const { identityHash, ipHash } = await loginFingerprints(email);
  const service = createServiceRoleClient();
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();

  const [{ count: identityFailures, error: identityError }, { count: ipFailures, error: ipError }] = await Promise.all([
    service
      .from("chillbros_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identity_hash", identityHash)
      .eq("success", false)
      .gte("attempted_at", since),
    service
      .from("chillbros_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .eq("success", false)
      .gte("attempted_at", since),
  ]);

  // Availability wins if the audit table itself is temporarily unavailable;
  // Supabase Auth still applies its own protections in that situation.
  if (identityError || ipError) return { allowed: true, identityHash, ipHash };
  if ((identityFailures ?? 0) >= IDENTITY_FAILURE_LIMIT || (ipFailures ?? 0) >= IP_FAILURE_LIMIT) return { allowed: false };
  return { allowed: true, identityHash, ipHash };
}

export async function recordLoginAttempt(input: { identityHash: string; ipHash: string; success: boolean }) {
  const service = createServiceRoleClient();
  if (input.success) {
    await service
      .from("chillbros_login_attempts")
      .delete()
      .or(`identity_hash.eq.${input.identityHash},ip_hash.eq.${input.ipHash}`)
      .eq("success", false);
  }

  await service.from("chillbros_login_attempts").insert({
    identity_hash: input.identityHash,
    ip_hash: input.ipHash,
    success: input.success,
  });

  // Keep the table bounded without creating another scheduled service.
  const retentionCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await service.from("chillbros_login_attempts").delete().lt("attempted_at", retentionCutoff);
}
