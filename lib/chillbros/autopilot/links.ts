import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export function appBase() {
  return String(process.env.NEXT_PUBLIC_APP_URL || "https://chill-bros.vercel.app").replace(/\/+$/, "");
}

function secret() {
  const s = String(process.env.AUTOPILOT_SECRET || process.env.CRON_SECRET || "").trim();
  if (!s) throw new Error("AUTOPILOT_SECRET or CRON_SECRET must be set for signed links.");
  return s;
}

export function normalizeContact(value: string) {
  const v = String(value || "").trim().toLowerCase();
  if (v.includes("@")) return v;
  const digits = v.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return v;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(`unsub:${value}`).digest("base64url").slice(0, 22);
}

export function unsubscribeUrl(contact: string) {
  const c = normalizeContact(contact);
  return `${appBase()}/u?c=${encodeURIComponent(c)}&s=${sign(c)}`;
}

export function verifyUnsubscribe(contact: string, signature: string) {
  const expected = Buffer.from(sign(normalizeContact(contact)));
  const given = Buffer.from(String(signature || ""));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Booking link with attribution: l=<inbound lead token>, p=<prospect id>, c=<customer id>. */
export function bookingUrl(ref?: { kind: "l" | "p" | "c"; value: string }) {
  return ref ? `${appBase()}/book?${ref.kind}=${encodeURIComponent(ref.value)}` : `${appBase()}/book`;
}
