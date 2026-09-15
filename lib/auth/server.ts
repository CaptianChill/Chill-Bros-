import "server-only";

import { createHash } from "node:crypto";
import { createNeonAuth } from "@neondatabase/auth/next/server";

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
});
