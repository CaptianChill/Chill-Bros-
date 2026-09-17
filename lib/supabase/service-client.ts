import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./config";

/**
 * Server-only operational client retained for tables that have not completed
 * the user-JWT/RLS migration. Never import this client into browser code.
 */
export function createServiceRoleClient(): SupabaseClient {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase server credentials are not configured.");
  return createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}


/**
 * Data API client carrying the current Neon Auth access JWT. Use this for
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