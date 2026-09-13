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

function operationalProfileEmail(email: string) {
  return email.toLowerCase() === "chillprostx@gmail.com" ? "chillbrostx@gmail.com" : email;
}

/**
 * Legacy Supabase auth client retained only for the remaining migration-era
 * admin/recovery actions. New interactive staff sign-in uses Neon Auth.
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
          // Called from a Server Component render; auth middleware/server actions
          // own session mutation instead.
        }
      },
    },
  });
}

/**
 * Returns an active Chill Bros staff profile using the Neon Auth session.
 * The operational data layer is still read through the existing service client
 * during cutover, so profile authorization is matched by canonical email.
 */
export async function getCurrentStaffProfile(): Promise<StaffProfile | null> {
  const { data: session } = await neonAuth.getSession();
  const user = session?.user;
  if (!user?.email) return null;

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("chillbros_profiles")
    .select("id, full_name, email, role, status")
    .ilike("email", operationalProfileEmail(user.email))
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
