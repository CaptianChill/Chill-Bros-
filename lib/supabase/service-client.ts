import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./config";

/**
 * Full-access client, service-role key only. Never imported from a
 * "use client" component — this is the only client allowed to read/write
 * chillbros_* tables (RLS locks them to service_role) and to call the Auth
 * Admin API (create/reset staff accounts).
 */
export function createServiceRoleClient(): SupabaseClient {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase server credentials are not configured.");
  return createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
