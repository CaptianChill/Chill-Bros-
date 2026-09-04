import { redirect } from "next/navigation";

import { LogoBadge } from "@/components/logo-badge";
import { ManagerMfaPanel } from "@/components/manager-mfa-panel";
import { safeInternalPath } from "@/lib/chillbros/security-guards";
import { createAuthServerClient, getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function ManagerMfaPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeInternalPath(params.next, "/");
  const profile = await getCurrentStaffProfile({ allowManagerAal1: true });
  if (!profile) redirect(`/sign-in?next=${encodeURIComponent(`/security/mfa?next=${encodeURIComponent(next)}`)}`);
  if (profile.role !== "manager") redirect("/");

  const auth = await createAuthServerClient();
  const [{ data: factors }, { data: assurance }] = await Promise.all([
    auth.auth.mfa.listFactors(),
    auth.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const verifiedPhoneFactor = factors?.phone?.find((factor) => factor.status === "verified") ?? null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-8 text-foreground sm:px-6">
      <section className="w-full rounded-3xl border border-[#2d7dff]/45 bg-[#020407]/96 p-5 shadow-[0_0_32px_rgba(45,125,255,0.2)] sm:p-7">
        <div className="mb-6 flex items-center gap-4 border-b border-[#2d7dff]/20 pb-5">
          <LogoBadge variant="full" className="w-14 shrink-0 sm:w-16" />
          <div className="min-w-0">
            <p className="font-brand text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8ffafa]">Chill Bros Security Gate</p>
            <h1 className="neon-text mt-1 text-2xl font-semibold text-white sm:text-3xl">Manager text verification</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Owner-level controls require your password plus a six-digit security code sent to your mobile phone.</p>
          </div>
        </div>
        <ManagerMfaPanel currentLevel={assurance?.currentLevel ?? null} verifiedFactorId={verifiedPhoneFactor?.id ?? null} next={next} />
      </section>
    </main>
  );
}
