import { LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in?next=%2Fsecurity");
  if (profile.role !== "manager") redirect("/");

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
              ["Supply-chain checks", "GitHub security CI audits dependencies, lints the application, verifies identity contracts, and runs a production build."],
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
          <SectionCard eyebrow="Account sessions" title="Session controls" description="Use the normal sign-out control on this device. Multi-device session revocation will return only after it is implemented against Neon Auth.">
            <p className="rounded-2xl border border-amber-300/30 bg-amber-300/5 px-4 py-3 text-sm leading-6 text-amber-100">
              Do not rely on the old Supabase session-revocation control. It belonged to the retired authentication backend and could not revoke Neon Auth sessions.
            </p>
          </SectionCard>

          <SectionCard eyebrow="Authentication" title="Two-factor authentication disabled" description="The paid/SMS MFA gate has been removed from Chill Bros.">
            <div className="flex gap-3 rounded-2xl border border-[#2d7dff]/25 bg-black/25 p-4">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#8ffafa]" />
              <p className="text-sm leading-6 text-zinc-300">Managers sign in with their normal account password and active Neon Auth session. Backend role checks and security controls still apply to every protected operation.</p>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
