import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
function secret() {
  const value = process.env.LEAD_MARKET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Mailbox encryption is not configured.");
  return value;
}
export function sealCredentials(buyerId: string, credentials: unknown) {
  const key = createHash("sha256").update("lead-market-mailbox/v1\0" + secret()).digest();
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(buyerId));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
export function unsealCredentials<T>(buyerId: string, value: string): T {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Mailbox credentials must be reconnected.");
  const key = createHash("sha256").update("lead-market-mailbox/v1\0" + secret()).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(buyerId)); decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8")) as T;
}
export function optOutSignature(buyerId: string, contact: string) { return createHmac("sha256", secret()).update(`market-unsubscribe/v1\0${buyerId}\0${contact.trim().toLowerCase()}`).digest("base64url"); }
export function validOptOut(buyerId: string, contact: string, signature: string) {
  const a = Buffer.from(optOutSignature(buyerId, contact)); const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
