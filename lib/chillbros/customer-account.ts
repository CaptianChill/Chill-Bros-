import "server-only";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

/**
 * Customer accounts for the customer homepage (/my).
 *
 * Customers are NOT staff and never touch Neon Auth. They sign in with a
 * one-time code sent to their email. Once the code proves they own that
 * email, the account is linked to every existing chillbros_customers row with
 * the same email, so an existing customer immediately sees their units,
 * history, estimates and invoices. Links are refreshed on every sign-in, so
 * a customer record the office adds later with that email shows up too.
 */

export const CUSTOMER_SESSION_COOKIE = "cp_customer_session";
const SESSION_DAYS = 60;
const CODE_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;

export type CustomerSession = {
  accountId: string;
  email: string;
  customerIds: string[];
};

export function normalizeEmail(value: string | null | undefined) {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320 ? email : null;
}

function pepper() {
  const configured = String(process.env.CUSTOMER_AUTH_SECRET || "").trim();
  if (configured) return configured;
  const service = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!service) throw new Error("Customer sign-in is not configured.");
  return createHash("sha256").update("chillpros/customer-auth/v1\0").update(service).digest("base64url");
}

function hash(...parts: string[]) {
  const h = createHash("sha256").update(pepper());
  for (const part of parts) h.update("\0").update(part);
  return h.digest("hex");
}

function sameHash(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Creates a one-time code for this email. Returns null when rate-limited. */
export async function createLoginCode(email: string): Promise<string | null> {
  const s = createServiceRoleClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await s.from("chillbros_customer_login_codes").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", hourAgo);
  if ((count ?? 0) >= MAX_CODES_PER_HOUR) return null;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await s.from("chillbros_customer_login_codes").insert({
    email,
    code_hash: hash("code", email, code),
    expires_at: new Date(Date.now() + CODE_MINUTES * 60 * 1000).toISOString(),
  });
  if (error) throw new Error("Could not create a sign-in code.");
  return code;
}

/** Checks the newest unused code for this email. */
export async function verifyLoginCode(email: string, code: string): Promise<"ok" | "invalid" | "expired" | "locked"> {
  const clean = code.replace(/\D/g, "");
  const s = createServiceRoleClient();
  const { data: row } = await s.from("chillbros_customer_login_codes")
    .select("id,code_hash,expires_at,attempts,used_at")
    .eq("email", email).is("used_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!row) return "expired";
  if (new Date(row.expires_at).getTime() < Date.now()) return "expired";
  if (row.attempts >= MAX_CODE_ATTEMPTS) return "locked";
  if (clean.length !== 6 || !sameHash(row.code_hash, hash("code", email, clean))) {
    await s.from("chillbros_customer_login_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    return row.attempts + 1 >= MAX_CODE_ATTEMPTS ? "locked" : "invalid";
  }
  await s.from("chillbros_customer_login_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
  return "ok";
}

/** Customer rows whose email matches (case-insensitive). */
export async function findCustomerIdsByEmail(email: string): Promise<string[]> {
  const s = createServiceRoleClient();
  const { data } = await s.from("chillbros_customers").select("id,email").ilike("email", email);
  return (data ?? []).filter((r) => normalizeEmail(r.email) === email).map((r) => r.id as string);
}

/** Finds or creates the account for a verified email and links matching customers. */
export async function upsertAccountAndLink(email: string): Promise<{ accountId: string; customerIds: string[] }> {
  const s = createServiceRoleClient();
  let { data: account } = await s.from("chillbros_customer_accounts").select("id").eq("email", email).maybeSingle();
  if (!account) {
    const { data: created, error } = await s.from("chillbros_customer_accounts").insert({ email }).select("id").single();
    if (error || !created) {
      // Two sign-ins racing: read the row the other request created.
      const { data: again } = await s.from("chillbros_customer_accounts").select("id").eq("email", email).maybeSingle();
      if (!again) throw new Error("Could not create your account.");
      account = again;
    } else {
      account = created;
    }
  }
  const matches = await findCustomerIdsByEmail(email);
  if (matches.length) {
    await s.from("chillbros_customer_account_links").upsert(
      matches.map((customer_id) => ({ account_id: account!.id, customer_id, link_source: "email_match" })),
      { onConflict: "account_id,customer_id", ignoreDuplicates: true },
    );
  }
  await s.from("chillbros_customer_accounts").update({ last_login_at: new Date().toISOString() }).eq("id", account.id);
  const customerIds = await linkedCustomerIds(account.id);
  return { accountId: account.id, customerIds };
}

export async function linkedCustomerIds(accountId: string): Promise<string[]> {
  const s = createServiceRoleClient();
  const { data } = await s.from("chillbros_customer_account_links").select("customer_id").eq("account_id", accountId);
  return (data ?? []).map((r) => r.customer_id as string);
}

export async function startCustomerSession(accountId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const s = createServiceRoleClient();
  const { error } = await s.from("chillbros_customer_sessions").insert({ account_id: accountId, token_hash: hash("session", token), expires_at: expires.toISOString() });
  if (error) throw new Error("Could not start your session.");
  const jar = await cookies();
  jar.set(CUSTOMER_SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires });
}

export async function endCustomerSession() {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (token) {
    await createServiceRoleClient().from("chillbros_customer_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hash("session", token));
  }
  jar.delete(CUSTOMER_SESSION_COOKIE);
}

/** The signed-in customer, or null. Every customer page and action checks this. */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token || token.length < 20) return null;
  const s = createServiceRoleClient();
  const { data } = await s.from("chillbros_customer_sessions")
    .select("account_id,expires_at,revoked_at,account:chillbros_customer_accounts(email)")
    .eq("token_hash", hash("session", token)).maybeSingle();
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() < Date.now()) return null;
  const account = Array.isArray(data.account) ? data.account[0] : data.account;
  if (!account) return null;
  return { accountId: data.account_id, email: account.email, customerIds: await linkedCustomerIds(data.account_id) };
}

/** Links a brand-new customer record (created from the welcome form) to the account. */
export async function linkNewCustomer(accountId: string, customerId: string) {
  await createServiceRoleClient().from("chillbros_customer_account_links").insert({ account_id: accountId, customer_id: customerId, link_source: "self_signup" });
}
