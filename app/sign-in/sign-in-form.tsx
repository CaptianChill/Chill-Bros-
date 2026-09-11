"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LogIn } from "lucide-react";

import { signInAction } from "./actions";

export function SignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signInAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-2">
        <span className="text-sm text-zinc-300">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="you@chillbros.local"
          className="w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm text-zinc-300">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none"
        />
      </label>

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-xs font-medium text-[#bafcfc] hover:text-white">
          Forgot password?
        </Link>
      </div>

      {state?.error ? <p className="text-sm text-[#ff9b9b]">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl neon-tube bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] transition hover:bg-[#2d7dff]/20 disabled:opacity-60"
      >
        <LogIn className="h-4 w-4" />
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
