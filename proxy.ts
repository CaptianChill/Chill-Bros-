import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATH_PREFIXES = ["/sign-in", "/forgot-password", "/auth/callback", "/portal", "/agreement", "/_next", "/favicon.ico", "/logo", "/manifest.webmanifest", "/api/portal", "/api/3d-project-builder/blender-self-test"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}.`));
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const anonKey = (process.env.SUPABASE_ANON_KEY || "").trim();

  if (!url || !anonKey) {
    return new NextResponse("Chill Bros authentication configuration is unavailable.", { status: 503 });
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
