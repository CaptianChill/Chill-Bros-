import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoBadge } from "@/components/logo-badge";
import { createAuthServerClient, getCurrentStaffProfile } from "@/lib/supabase/auth-server";

type UpdatePasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function UpdatePasswordPage({ searchParams }: UpdatePasswordPageProps) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  const { error } = await searchParams;

  async function updatePassword(formData: FormData) {
    "use server";

    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirm") || "");
    if (password.length < 10) redirect("/account/update-password?error=length");
    if (password !== confirm) redirect("/account/update-password?error=match");

    const supabase = await createAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/sign-in");

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) redirect("/account/update-password?error=update");

    await supabase.auth.signOut();
    redirect("/sign-in?password=updated");
  }

  const errorMessage = error === "length"
    ? "Use at least 10 characters for the new password."
    : error === "match"
      ? "The two passwords do not match."
      : error
        ? "The password could not be updated. Request a new reset link and try again."
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4 text-foreground">
      <div className="panel w-full max-w-sm space-y-6 neon-frame sign-surface rounded-3xl p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoBadge variant="full" className="w-16" />
          <div>
            <p className="sub text-sm uppercase tracking-[0.3em]">Account security</p>
            <h1 className="glo mt-1 text-xl font-semibold">Choose a new password</h1>
            <p className="mt-2 text-xs text-zinc-400">{profile.email}</p>
          </div>
        </div>

        {errorMessage ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{errorMessage}</p> : null}

        <form action={updatePassword} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">New password</span>
            <input name="password" type="password" required minLength={10} autoComplete="new-password" className="w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Confirm new password</span>
            <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className="w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none" />
          </label>
          <button type="submit" className="w-full rounded-2xl neon-tube bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] transition hover:bg-[#2d7dff]/20">
            Save new password
          </button>
        </form>

        <Link href="/" className="block text-center text-sm text-[#bafcfc] hover:text-white">Return to Chill Bros</Link>
      </div>
    </div>
  );
}
