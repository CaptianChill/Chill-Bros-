import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { auth as neonAuth } from "@/lib/auth/server";
import { getSupabaseConfig } from "./config";
import { createServiceRoleClient } from "./service-client";

export type StaffProfile = {
  id: string;
  fullName: string;
  email: string;
  role: "manager" | "technician" | "office";
  status: "active" | "inactive";
};

const OWNER_EMAIL = "chillprostx@gmail.com";
const OWNER_PROFILE_ID = "8c81f12a-ad86-4ceb-bca1-3924be1cbfec";

/**
 * Legacy Supabase auth client retained only for remaining migration-era
 * admin/recovery actions. Interactive sign-in uses Neon Auth.
 */
export async function createAuthServerClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase server credentials are not configured.");
  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Actions / Neon middleware own interactive session mutation.
        }
      },
    },
  });
}

/**
 * Returns an active Chill Bros staff profile using the Neon Auth session.
 * Owner authorization is resolved directly from the authenticated Neon
 * identity so the legacy Supabase data client cannot block owner access.
 */
export async function getCurrentStaffProfile(): Promise<StaffProfile | null> {
  const { data: session } = await neonAuth.getSession();
  const user = session?.user;
  if (!user?.email) return null;

  if (user.email.toLowerCase() === OWNER_EMAIL) {
    return {
      id: OWNER_PROFILE_ID,
      fullName: user.name || "Brae Morrison",
      email: OWNER_EMAIL,
      role: "manager",
      status: "active",
    };
  }

  // Temporary compatibility path for non-owner staff until the operational
  // data layer is fully cut over to Neon.
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("chillbros_profiles")
    .select("id, full_name, email, role, status")
    .ilike("email", user.email)
    .maybeSingle();

  if (error || !data || data.status !== "active") return null;

  return {
    id: data.id,
    fullName: data.full_name,
    email: user.email,
    role: data.role,
    status: data.status,
  };
}
