import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "nso_owner";
const token = () => createHash("sha256").update(`owner:${process.env.OWNER_PASSWORD ?? ""}`).digest("hex");

export async function isOwner() {
  if (!process.env.OWNER_PASSWORD) return false;
  const v = (await cookies()).get(COOKIE)?.value ?? "";
  const a = Buffer.from(v), b = Buffer.from(token());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function signIn(password: string) {
  const expected = process.env.OWNER_PASSWORD ?? "";
  const a = Buffer.from(password), b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) return false;
  (await cookies()).set(COOKIE, token(), { httpOnly: true, secure: true, sameSite: "lax", path: "/owner", maxAge: 60 * 60 * 24 * 30 });
  return true;
}
