import { LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

import { revokeOtherSessionsAction } from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ revoked?: string; error?: string }> };

export default async function SecurityPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in?next=%2Fsecurity");
  if (profile.role !== "manager") redirect("/");

  const params = await searchParams;

  return (
    <AppShell
      title="Security Center"
      description="Manager-only security controls and current backend protections. Two-factor authentication is disabled; password/session authentication and server-side authorization remain active."
      highlight={
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Security status</p>
          <StatusPill tone="emerald">Backend protections active</StatusPill>
          <StatusPill>Password + session access</StatusPill>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          eyebrow="Protection layer"
          title="What remains active"
          description="Removing paid MFA does not change the app's server-side authorization or database restrictions."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Login throttling", "Repeated failed sign-in attempts are rate-limited and logged using hashed identifiers."],
              ["Role authorization", "Manager, office, and technician permissions are re-checked on the server before protected actions."],
              ["Private business data", "Chill Bros business tables and private media are not directly exposed to anonymous browser clients."],
              ["Browser hardening", "CSP, anti-clickjacking, no-sniff, HSTS, noindex, and restrictive browser permissions remain enabled."],
              ["Supply-chain checks", "GitHub security CI continues to audit dependencies, lint the application, and run a production build."],
              ["Protected workflows", "Closed calls, estimates, parts, payments, timesheets, staff controls, and uploads retain server-side validation."],
            ].map(([title, text]) => (
              <article key={title} className="rounded-2xl border border-[#2d7dff]/25 bg-black/25 p-4">
                <div className="flex items-center gap-2 text-white"><ShieldCheck className="h-4 w-4 text-[#8ffafa]" /><h3 className="font-semibold">{title}</h3></div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
              </article>
            ))}
          </div>
        </SectionCard>

        <div className="grid gap-4">
          <SectionCard eyebrow="Account sessions" title="Revoke other sessions" description="Use this after a suspicious login alert, a lost device, or whenever you want to invalidate other signed-in sessions.">
            {params.revoked === "1" ? <p className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">Other sessions were revoked. This device remains signed in.</p> : null}
            {params.error ? <p className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-200">The other sessions could not be revoked. Sign out and back in, then try again.</p> : null}
            <form action={revokeOtherSessionsAction}>
              <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/5 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-300/10">
                <LogOut className="h-4 w-4" /> Revoke other signed-in sessions
              </button>
            </form>
          </SectionCard>

          <SectionCard eyebrow="Authentication" title="Two-factor authentication disabled" description="The paid/SMS MFA gate has been removed from Chill Bros.">
            <div className="flex gap-3 rounded-2xl border border-[#2d7dff]/25 bg-black/25 p-4">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#8ffafa]" />
              <p className="text-sm leading-6 text-zinc-300">Managers now sign in with their normal account password and active Supabase session. Backend role checks and security controls still apply to every protected operation.</p>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
