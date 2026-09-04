import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseConfig } from "./config";
import { createServiceRoleClient } from "./service-client";

export type StaffProfile = {
  id: string;
  fullName: string;
  email: string;
  role: "manager" | "technician" | "office";
  status: "active" | "inactive";
};

/**
 * Session-aware client bound to this request's cookies (anon key — respects
 * whatever the signed-in user's own session is). Used only for auth/session
 * operations, never for direct chillbros_* table access.
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
          // Called from a Server Component render; middleware refreshes the
          // session cookie instead, so this can be safely ignored here.
        }
      },
    },
  });
}

/**
 * Returns an active staff profile. Manager sessions fail closed unless they
 * have reached AAL2 (password + MFA). The MFA setup route opts into the one
 * narrow exception needed to let an AAL1 manager enroll/challenge a factor.
 */
export async function getCurrentStaffProfile(options: { allowManagerAal1?: boolean } = {}): Promise<StaffProfile | null> {
  const auth = await createAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return null;

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("chillbros_profiles")
    .select("id, full_name, email, role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data || data.status !== "active") return null;

  if (data.role === "manager" && !options.allowManagerAal1) {
    const { data: assurance, error: assuranceError } = await auth.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.currentLevel !== "aal2") return null;
  }

  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    role: data.role,
    status: data.status,
  };
}
