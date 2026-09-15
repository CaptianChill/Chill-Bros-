import Link from "next/link";

import { LogoBadge } from "@/components/logo-badge";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4 text-foreground">
      <div className="panel w-full max-w-sm space-y-6 neon-frame sign-surface rounded-3xl p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoBadge variant="full" className="w-16" />
          <div>
            <p className="sub text-sm uppercase tracking-[0.3em]">Account recovery</p>
            <h1 className="glo mt-1 text-xl font-semibold">Contact your manager</h1>
          </div>
        </div>

        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
          Self-service password reset is temporarily unavailable while the secure Neon recovery flow is completed.
          No account or password can be created from this public page.
        </p>

        <p className="text-sm leading-6 text-zinc-400">
          Ask a Chill Bros manager to verify your staff profile and restore access. Never send a password by text or email.
        </p>

        <Link href="/sign-in" className="block text-center text-sm text-[#bafcfc] hover:text-white">
          Back to staff sign in
        </Link>
      </div>
    </div>
  );
}
