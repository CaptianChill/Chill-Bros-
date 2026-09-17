import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { auth as neonAuth } from "@/lib/auth/server";
import { getSupabaseConfig } from "./config";

async function currentNeonAccessToken(): Promise<string | null> {
  try {
    const result = await neonAuth.token();
    if (result?.error || !result?.data) return null;

    if (typeof result.data === "string") {
      const token = result.data.trim();
      return token || null;
    }

    if (typeof result.data === "object" && "token" in result.data) {
      const token = (result.data as { token?: unknown }).token;
      return typeof token === "string" && token.trim() ? token.trim() : null;
    }
  } catch {
    // Public/tokenless server flows still use the legacy server credential below.
  }

  return null;
}

/**
 * Server-only operational client.
 *
 * Chill Bros now authenticates staff with Neon Auth while some server actions
 * still call this legacy helper. When a staff session exists, replace the old
 * Supabase service-role Authorization header with the signed Neon Auth JWT so
 * the Neon Data API runs the request as the authenticated database role. For
 * public/tokenless server flows, preserve the legacy credential behavior until
 * those routes finish their migration.
 */
export function createServiceRoleClient(): SupabaseClient {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase server credentials are not configured.");

  let tokenPromise: Promise<string | null> | null = null;
  const neonAwareFetch: typeof fetch = async (input, init) => {
    tokenPromise ??= currentNeonAccessToken();
    const accessToken = await tokenPromise;
    if (!accessToken) return fetch(input, init);

    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("apikey", config.anonKey);
    return fetch(input, { ...init, headers });
  };

  return createClient(config.url, config.serviceRoleKey, {
    global: { fetch: neonAwareFetch },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Data API client carrying an explicit Neon Auth access JWT. Use this for
 * RLS-protected tables so Postgres can enforce auth.uid() ownership.
 */
export function createUserScopedDataClient(accessToken: string): SupabaseClient {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Neon Data API credentials are not configured.");
  if (!accessToken.trim()) throw new Error("A Neon Auth access token is required.");
  return createClient(config.url, config.anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
