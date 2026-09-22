import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoBadge } from "@/components/logo-badge";
import { auth } from "@/lib/auth/server";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

type UpdatePasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function UpdatePasswordPage({ searchParams }: UpdatePasswordPageProps) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  const { error } = await searchParams;

  async function updatePassword(formData: FormData) {
    "use server";

    const currentPassword = String(formData.get("currentPassword") || "");
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirm") || "");
    if (!currentPassword) redirect("/account/update-password?error=current");
    if (password.length < 12 || password.length > 128) redirect("/account/update-password?error=length");
    if (password !== confirm) redirect("/account/update-password?error=match");

    const { error: updateError } = await auth.changePassword({
      currentPassword,
      newPassword: password,
      revokeOtherSessions: true,
    });
    if (updateError) redirect("/account/update-password?error=update");

    await auth.signOut().catch(() => undefined);
    redirect("/sign-in?password=updated");
  }

  const errorMessage = error === "current"
    ? "Enter your current password."
    : error === "length"
      ? "Use a new password between 12 and 128 characters."
      : error === "match"
        ? "The two new passwords do not match."
        : error
          ? "The password could not be updated. Check your current password and try again."
          : null;

  return (
    <div className="cb-staff cb-camo-page">
      <div className="cb-page flex min-h-screen items-center justify-center px-4">
        <div className="panel w-full max-w-sm space-y-6 neon-frame sign-surface rounded-3xl p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <LogoBadge variant="full" className="w-16" />
            <div>
              <p className="sub text-sm uppercase tracking-[0.3em]">Account security</p>
              <h1 className="glo mt-1 text-xl font-semibold">Change password</h1>
              <p className="mt-2 text-xs text-zinc-400">{profile.email}</p>
            </div>
          </div>

          {errorMessage ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{errorMessage}</p> : null}

          <form action={updatePassword} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Current password</span>
              <input name="currentPassword" type="password" required autoComplete="current-password" className="w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">New password</span>
              <input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className="w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Confirm new password</span>
              <input name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className="w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none" />
            </label>
            <button type="submit" className="w-full rounded-2xl neon-tube bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] transition hover:bg-[#2d7dff]/20">
              Save new password
            </button>
          </form>

          <Link href="/" className="block text-center text-sm text-[#bafcfc] hover:text-white">Return to Chill Bros</Link>
        </div>
      </div>
    </div>
  );
}
