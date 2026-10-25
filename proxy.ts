import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/server";

const PUBLIC_PATH_PREFIXES = [
  "/sign-in",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/portal",
  // Customer homepage: its own email-code sign-in (lib/chillbros/customer-account.ts), not Neon Auth.
  "/my",
  "/agreement",
  // Lead Autopilot: public booking page, unsubscribe page, and secret-guarded lead intake.
  "/book",
  "/u",
  "/api/leads",
  // Database webhook for staff texts; checks its own NOTIFY_WEBHOOK_SECRET bearer token.
  "/api/notify",
  "/_next",
  "/favicon.ico",
  "/logo",
  "/manifest.webmanifest",
  // Service worker for owner phone alerts (must load without a session redirect).
  "/sw.js",
  "/field-notes/manifest.webmanifest",
  "/api/auth",
  "/api/health",
  "/api/portal",
  "/api/payments/square/webhook",
  "/api/cron",
  // Brae.I. read-only API: no Neon session; each route checks its own BRAE_API_KEY bearer token.
  "/api/brae",
  // Owner command center (Chill Pros HQ) bridge: no Neon session; checks its own HQ_BRIDGE_SECRET header.
  "/api/hq",
  // BB Command Center: static owner home screen (no customer data; links + public weather only).
  "/command-center",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(`${prefix}/`) ||
      pathname.startsWith(`${prefix}.`),
  );
}

const neonAuthProxy = auth.middleware({ loginUrl: "/sign-in" });

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Neon Auth is the single source of truth for interactive sessions.
  // This validates/refreshes Neon session cookies and redirects only when
  // the Neon session is missing or invalid.
  const response = await neonAuthProxy(request);
  if (pathname === "/field-notes" && response.headers.get("location")) {
    const destination = new URL(response.headers.get("location")!, request.url);
    if (destination.pathname === "/sign-in") {
      destination.searchParams.set("next", "/field-notes");
      response.headers.set("location", destination.toString());
    }
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-action" },
        { type: "header", key: "rsc" },
      ],
    },
  ],
};
