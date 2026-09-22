import Link from "next/link";

import { LogoBadge } from "@/components/logo-badge";
import { ResetPasswordForm } from "./reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token, error } = await searchParams;
  const usableToken = typeof token === "string" && token.length > 20 ? token : "";

  return (
    <div className="cb-staff cb-camo-page">
      <div className="cb-page flex min-h-screen items-center justify-center px-4">
        <div className="panel w-full max-w-sm space-y-6 neon-frame sign-surface rounded-3xl p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <LogoBadge variant="full" className="w-16" />
            <div>
              <p className="sub text-sm uppercase tracking-[0.3em]">Account recovery</p>
              <h1 className="glo mt-1 text-xl font-semibold">Choose a new password</h1>
            </div>
          </div>

          {!usableToken || error ? (
            <div className="space-y-4">
              <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                This password-reset link is invalid or expired. Request a fresh email and use the newest link.
              </p>
              <Link href="/forgot-password" className="block rounded-2xl neon-tube bg-[#2d7dff]/10 px-4 py-3 text-center font-medium text-[#d9fbff] transition hover:bg-[#2d7dff]/20">
                Request new reset email
              </Link>
            </div>
          ) : (
            <ResetPasswordForm token={usableToken} />
          )}
        </div>
      </div>
    </div>
  );
}
