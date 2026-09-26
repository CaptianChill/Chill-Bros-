import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/server";

const PUBLIC_PATH_PREFIXES = [
  "/sign-in",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/portal",
  "/agreement",
  "/_next",
  "/favicon.ico",
  "/logo",
  "/manifest.webmanifest",
  "/field-notes/manifest.webmanifest",
  "/api/auth",
  "/api/health",
  "/api/portal",
  "/api/payments/square/webhook",
  "/api/cron",
  "/api/3d-project-builder/blender-self-test",
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
