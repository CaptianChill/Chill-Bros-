import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";

const NEON_AUTH_BASE_URL =
  process.env.NEON_AUTH_BASE_URL ||
  "https://ep-jolly-field-ay0y9fdh.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth";

const NEON_AUTH_COOKIE_SECRET =
  process.env.NEON_AUTH_COOKIE_SECRET ||
  "cb_owner_bridge_7Sx9wQ2nL5rV8kP4mD6yH3tF1zC0aB";

export const auth = createNeonAuth({
  baseUrl: NEON_AUTH_BASE_URL,
  cookies: {
    secret: NEON_AUTH_COOKIE_SECRET,
    sessionDataTtl: 300,
  },
});
