import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoBadge } from "@/components/logo-badge";
import { auth } from "@/lib/auth/server";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ ready?: string; error?: string }>;
};

const OWNER_EMAIL = "chillprostx@gmail.com";

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const { ready, error } = await searchParams;

  async function createOwnerPassword(formData: FormData) {
    "use server";

    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirm") || "");

    if (email !== OWNER_EMAIL) redirect("/forgot-password?error=owner");
    if (password.length < 12 || password.length > 128) redirect("/forgot-password?error=password");
    if (password !== confirm) redirect("/forgot-password?error=match");

    const { error: signUpError } = await auth.signUp.email({
      email,
      password,
      name: "Brae Morrison",
    });

    if (signUpError) redirect("/forgot-password?error=exists");

    redirect("/?ownerSetup=1");
  }

  const errorMessage =
    error === "owner"
      ? "Use the Chill Bros owner email shown below."
      : error === "password"
        ? "Use a password between 12 and 128 characters."
        : error === "match"
          ? "The two passwords do not match."
          : error === "exists"
            ? "The owner account already has a password. Return to staff sign in and use it there."
            : "Owner recovery could not be completed.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4 text-foreground">
      <div className="panel w-full max-w-sm space-y-6 neon-frame sign-surface rounded-3xl p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoBadge variant="full" className="w-16" />
          <div>
            <p className="sub text-sm uppercase tracking-[0.3em]">Owner recovery</p>
            <h1 className="glo mt-1 text-xl font-semibold">Create owner password</h1>
          </div>
        </div>

        {ready === "1" ? (
          <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Owner access is ready. Create your password below.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}

        <form action={createOwnerPassword} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Owner email</span>
            <input
              name="email"
              type="email"
              required
              defaultValue={OWNER_EMAIL}
              readOnly
              className="w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">New password</span>
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              className="w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Confirm password</span>
            <input
              name="confirm"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              className="w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none"
            />
          </label>

          <button type="submit" className="w-full rounded-2xl neon-tube bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] transition hover:bg-[#2d7dff]/20">
            Create owner password & sign in
          </button>
        </form>

        <Link href="/sign-in" className="block text-center text-sm text-[#bafcfc] hover:text-white">
          Back to staff sign in
        </Link>
      </div>
    </div>
  );
}
