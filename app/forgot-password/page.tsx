import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LogoBadge } from "@/components/logo-badge";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ sent?: string; error?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const { sent, error } = await searchParams;

  async function requestPasswordReset(formData: FormData) {
    "use server";

    const email = String(formData.get("email") || "").trim().toLowerCase();
    if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      redirect("/forgot-password?error=invalid");
    }

    const requestHeaders = await headers();
    const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "chill-bros.vercel.app";
    const proto = requestHeaders.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;

    const supabase = await createAuthServerClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/account/update-password`,
    });

    // Keep the response generic so this page never reveals whether an email exists.
    if (resetError) redirect("/forgot-password?error=send");
    redirect("/forgot-password?sent=1");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4 text-foreground">
      <div className="panel w-full max-w-sm space-y-6 neon-frame sign-surface rounded-3xl p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoBadge variant="full" className="w-16" />
          <div>
            <p className="sub text-sm uppercase tracking-[0.3em]">Account recovery</p>
            <h1 className="glo mt-1 text-xl font-semibold">Reset staff password</h1>
          </div>
        </div>

        {sent === "1" ? (
          <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            If that email belongs to an active Chill Bros account, a password-reset link has been sent. Check the inbox and spam folder.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error === "invalid" ? "Enter a valid email address." : "The reset email could not be sent right now. Contact your manager for an emergency password reset."}
          </p>
        ) : null}

        <form action={requestPasswordReset} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Staff email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@example.com"
              className="w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </label>
          <button type="submit" className="w-full rounded-2xl neon-tube bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] transition hover:bg-[#2d7dff]/20">
            Email reset link
          </button>
        </form>

        <Link href="/sign-in" className="block text-center text-sm text-[#bafcfc] hover:text-white">
          Back to staff sign in
        </Link>
      </div>
    </div>
  );
}
