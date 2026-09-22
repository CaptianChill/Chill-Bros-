"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { LogoBadge } from "@/components/logo-badge";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      });

      if (!response.ok) {
        setError("The reset email could not be sent. Try again in a moment.");
        return;
      }

      setSent(true);
    } catch {
      setError("The reset email could not be sent. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 text-foreground"
      style={{
        backgroundImage: "linear-gradient(rgba(4,6,10,.87), rgba(4,6,10,.87)), url('/brand/chill-pros-camo-blue.webp')",
        backgroundRepeat: "no-repeat, repeat",
        backgroundSize: "cover, 460px auto",
        backgroundPosition: "center top, top left",
      }}
    >
      <div className="panel w-full max-w-sm space-y-6 neon-frame sign-surface rounded-3xl p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoBadge variant="full" className="w-16" />
          <div>
            <p className="sub text-sm uppercase tracking-[0.3em]">Account recovery</p>
            <h1 className="glo mt-1 text-xl font-semibold">Reset your password</h1>
          </div>
        </div>

        {sent ? (
          <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm leading-6 text-emerald-100">
            <p className="font-semibold">Check your email.</p>
            <p>If that address belongs to a Chill Bros account, Neon Auth sent a secure password-reset link. Check spam or junk if it does not appear in your inbox.</p>
          </div>
        ) : (
          <form onSubmit={requestReset} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Account email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
              />
            </label>

            {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-2xl neon-tube bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] transition hover:bg-[#2d7dff]/20 disabled:opacity-60"
            >
              {pending ? "Sending reset email…" : "Email reset link"}
            </button>
          </form>
        )}

        <Link href="/sign-in" className="block text-center text-sm text-[#bafcfc] hover:text-white">
          Back to staff sign in
        </Link>
      </div>
    </div>
  );
}
