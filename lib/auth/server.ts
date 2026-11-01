import "server-only";

import { createHash } from "node:crypto";
import { createNeonAuth } from "@neondatabase/auth/next/server";
// Neon's 0.5 SDK embeds Better Auth 1.6 plugin declarations. Its admin type
// becomes unknown with patched 1.7 dependencies. Keep a narrow contract for the
// four existing server-proxy methods used here; protocol tests exercise the real
// SDK routing, cookie forwarding, response parsing, and error propagation.
type AdminUser = { id: string; email?: string | null };
type AdminResult<T> = Promise<{ data: T | null; error: { message?: string; status?: number } | null }>;
type PatchedAdmin = {
  listUsers(input: { query: { filterField: "email" | "id"; filterValue: string; filterOperator: "eq"; limit: number } }): AdminResult<{ users: AdminUser[] }>;
  createUser(input: { email: string; password: string; name: string; role: "user" }): AdminResult<{ user: AdminUser }>;
  setUserPassword(input: { userId: string; newPassword: string }): AdminResult<{ success: boolean }>;
  removeUser(input: { userId: string }): AdminResult<{ success: boolean }>;
};
type CompatibleNeonAuth = Omit<ReturnType<typeof createNeonAuth>, "admin"> & { admin: PatchedAdmin };

const NEON_AUTH_BASE_URL =
  process.env.NEON_AUTH_BASE_URL ||
  "https://ep-jolly-field-ay0y9fdh.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth";

function cookieSecret() {
  const configured = (process.env.NEON_AUTH_COOKIE_SECRET || "").trim();
  if (configured) return configured;

  // Production already requires this high-entropy server credential. Deriving
  // a domain-separated cookie key keeps urgent deployments safe until the
  // dedicated NEON_AUTH_COOKIE_SECRET is configured and rotated in Vercel.
  const serviceCredential = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!serviceCredential) {
    throw new Error("NEON_AUTH_COOKIE_SECRET is required.");
  }
  return createHash("sha256")
    .update("chillbros/neon-auth-cookie/v1\0")
    .update(serviceCredential)
    .digest("base64url");
}

export const auth = createNeonAuth({
  baseUrl: NEON_AUTH_BASE_URL,
  cookies: {
    secret: cookieSecret(),
    sessionDataTtl: 300,
  },
}) as CompatibleNeonAuth;
