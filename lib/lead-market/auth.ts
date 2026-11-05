import "server-only";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";
import { emailAddress } from "./rules";

const COOKIE = "cp_market_session";
function hash(scope: string, value: string) {
  const secret = process.env.LEAD_MARKET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Buyer sign-in is not configured.");
  return createHmac("sha256", secret).update(`lead-market/v1/${scope}\0${value}`).digest("hex");
}
export async function requestMarketCode(rawEmail: string) {
  const email = emailAddress(rawEmail);
  if (!email) throw new Error("Enter a valid email address.");
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const { data, error } = await createServiceRoleClient().rpc("chillbros_market_request_code", { email_input: email, hash_input: hash("code", `${email}\0${code}`) });
  if (error) throw new Error("Sign-in is temporarily unavailable.");
  if (!data) throw new Error("Too many sign-in requests. Please wait before requesting another code.");
  const result = await sendCompanyEmail(email, "Your lead marketplace sign-in code", `Your sign-in code is ${code}. It expires in 10 minutes. Only the newest requested code works.\n\nIf you did not request this code, ignore this email.`);
  if (result.status !== "sent") throw new Error("The code could not be sent. Please try later.");
  return email;
}
export async function verifyMarketCode(rawEmail: string, code: string) {
  const email = emailAddress(rawEmail);
  if (!email || !/^\d{6}$/.test(code)) throw new Error("Enter the email address and six-digit code.");
  const db = createServiceRoleClient();
  const { data, error } = await db.rpc("chillbros_market_verify_code", { email_input: email, hash_input: hash("code", `${email}\0${code}`) });
  if (error || !data) throw new Error("Code is invalid, expired, or locked. Request a new code.");
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 30 * 86400000);
  const saved = await db.from("chillbros_market_sessions").insert({ token_hash: hash("session", token), identity_id: data, expires_at: expires.toISOString() });
  if (saved.error) throw new Error("Could not start your buyer session.");
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}
export async function marketSession(): Promise<{ accountId: string; email: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || token.length < 32) return null;
  const { data, error } = await createServiceRoleClient().from("chillbros_market_sessions").select("identity_id,expires_at,revoked_at,identity:chillbros_market_identities(email)").eq("token_hash", hash("session", token)).maybeSingle();
  if (error) throw new Error("Buyer authentication is unavailable.");
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) return null;
  const identity = Array.isArray(data.identity) ? data.identity[0] : data.identity;
  return identity ? { accountId: data.identity_id, email: identity.email } : null;
}
export async function endMarketSession() {
  const jar = await cookies(); const token = jar.get(COOKIE)?.value;
  if (token) {
    const { error } = await createServiceRoleClient().from("chillbros_market_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hash("session", token));
    if (error) throw new Error("Could not sign out. Try again.");
  }
  jar.delete(COOKIE);
}
