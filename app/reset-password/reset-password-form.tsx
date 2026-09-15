"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 12 || password.length > 128) {
      setError("Use a password between 12 and 128 characters.");
      return;
    }

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword: password, token }),
      });

      if (!response.ok) {
        setError("This reset link is invalid or expired. Request a new reset email.");
        return;
      }

      window.location.assign("/sign-in?reset=1");
    } catch {
      setError("The password could not be changed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm text-zinc-300">New password</span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          className="w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm text-zinc-300">Confirm new password</span>
        <input
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          className="w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none"
        />
      </label>

      {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl neon-tube bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] transition hover:bg-[#2d7dff]/20 disabled:opacity-60"
      >
        {pending ? "Updating password…" : "Set new password"}
      </button>

      <Link href="/forgot-password" className="block text-center text-sm text-[#bafcfc] hover:text-white">
        Request another reset email
      </Link>
    </form>
  );
}
