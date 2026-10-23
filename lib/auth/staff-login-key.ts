import "server-only";

import { createHmac } from "node:crypto";

/**
 * Staff sign in with a one-time code sent to their email. Nobody types or
 * knows a password. Behind the scenes each staff login still needs a Neon
 * Auth credential, so the server derives one per email from a server-only
 * secret. The owner's "Add employee" / "Turn on email sign-in" buttons set
 * this credential on the employee's Neon login, and the code sign-in uses it
 * to open the session after the emailed code checks out.
 *
 * Rotating STAFF_LOGIN_SECRET (or the service-role key it falls back to)
 * changes every key; the owner then taps "Turn on email sign-in for everyone"
 * once to re-sync.
 */
function secret() {
  const configured = String(process.env.STAFF_LOGIN_SECRET || "").trim();
  if (configured) return configured;
  const service = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return service ? `chillpros/staff-login-key/v1\0${service}` : "";
}

export function hasStaffLoginKeySecret() {
  return Boolean(secret());
}

export function staffLoginKey(email: string) {
  const key = secret();
  if (!key) throw new Error("Staff email sign-in is not configured.");
  const normalized = String(email ?? "").trim().toLowerCase();
  // 43 URL-safe characters; well inside Neon Auth's 128-character limit.
  return createHmac("sha256", key).update(normalized).digest("base64url");
}

/** Code rows share the customer code table under a prefix customers can never produce. */
export function staffCodeKey(email: string) {
  return `staff:${String(email ?? "").trim().toLowerCase()}`;
}
