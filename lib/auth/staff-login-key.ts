import "server-only";

import { createHmac, randomInt } from "node:crypto";

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

/**
 * Name + PIN sign-in. The employee's 4-digit PIN is mixed with their email and
 * the same server-only secret to make their hidden Neon Auth credential, so
 * no PIN (or PIN hash) is stored anywhere in our database. A wrong PIN simply
 * produces a key Neon Auth rejects. The owner sets a PIN from the Owner screen.
 */
export function staffPinKey(email: string, pin: string) {
  const key = secret();
  if (!key) throw new Error("Staff PIN sign-in is not configured.");
  const normalized = String(email ?? "").trim().toLowerCase();
  return createHmac("sha256", key).update(`pin/v1\0${normalized}\0${String(pin)}`).digest("base64url");
}

export function isValidStaffPin(pin: string) {
  return /^\d{4}$/.test(String(pin ?? ""));
}

const WEAK_PINS = new Set(["0123", "1234", "2345", "3456", "4567", "5678", "6789", "9876", "8765", "7654", "6543", "5432", "4321", "3210", "1212", "6969", "2580", "1004", "2000", "1122"]);

export function isWeakStaffPin(pin: string) {
  return /^(\d)\1{3}$/.test(pin) || WEAK_PINS.has(pin);
}

/** Random, non-obvious 4-digit PIN. */
export function generateStaffPin() {
  for (;;) {
    const pin = String(randomInt(0, 10000)).padStart(4, "0");
    if (!isWeakStaffPin(pin)) return pin;
  }
}

/** "  eric   LARA " → "eric lara". Used to match typed names to staff profiles. */
export function normalizeStaffName(value: string) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
