import "server-only";


import { auth as neonAuth } from "@/lib/auth/server";
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
 * Returns an active Chill Bros staff profile using the Neon Auth session.
 * Owner authorization is resolved directly from the authenticated Neon
 * identity so the legacy Supabase data client cannot block owner access.
 */
export async function getCurrentStaffProfile(): Promise<StaffProfile | null> {
  const { data: session } = await neonAuth.getSession();
  const user = session?.user;
  if (!user?.id || !user.email) return null;

  if (user.email.toLowerCase() === OWNER_EMAIL) {
    return {
      id: OWNER_PROFILE_ID,
      fullName: user.name || "Brae Morrison",
      email: OWNER_EMAIL,
      role: "manager",
      status: "active",
    };
  }

  // Resolve authorization through the explicit Neon Auth foreign key. Email
  // remains display data and is never used as the account-authorization key.
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("chillbros_profiles")
    .select("id, full_name, email, role, status")
    .eq("auth_user_id", user.id)
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
