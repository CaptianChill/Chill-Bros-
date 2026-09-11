import { NextRequest, NextResponse } from "next/server";

import { safeInternalPath } from "@/lib/chillbros/security-guards";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeInternalPath(request.nextUrl.searchParams.get("next") || "/account/update-password");
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.search = "";

  if (code) {
    const supabase = await createAuthServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(redirectTo);
  }

  const failed = request.nextUrl.clone();
  failed.pathname = "/forgot-password";
  failed.search = "?error=send";
  return NextResponse.redirect(failed);
}
