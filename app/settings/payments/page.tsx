import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { SQUARE_PAYMENT_URL } from "@/lib/chillbros/square-payment";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { sendTestEmailAction } from "./actions";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ success?: string; error?: string }> };

export default async function PaymentSettingsPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");
  const params = await searchParams;

  return <AppShell title="Payments & Payouts" description="Customers can pay through Square, cash, or check." highlight={<StatusPill tone="emerald">Square payment link configured</StatusPill>}>
    <div className="space-y-5">
      {params.success ? <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{params.success}</p> : null}
      {params.error ? <p className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{params.error}</p> : null}
      <form data-no-draft action={sendTestEmailAction}>
        <button type="submit" className="min-h-12 rounded-2xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-5 py-3 font-semibold text-[#d9fbff]">Send test email</button>
        <p className="mt-2 text-sm text-zinc-400">Sends to your signed-in email: {profile.email}</p>
      </form>

      <SectionCard eyebrow="Customer payments" title="Square" description="Square is the main online payment option. Customers can also select cash or check.">
        <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-sm text-zinc-300">
          <a href={SQUARE_PAYMENT_URL} target="_blank" rel="noopener noreferrer" className="break-all text-[#bafcfc] underline">{SQUARE_PAYMENT_URL}</a>
          <p>Customers enter the invoice total in Square and use the name and email from their invoice. This shared link does not automatically fill in the amount or match a payment to an invoice.</p>
          <p>After confirming the completed payment, amount, and customer in your Square dashboard, open the matching invoice in Chill Pros and select Mark paid. Opening the link does not mark an invoice paid.</p>
          <a href="https://app.squareup.com/dashboard/payments" target="_blank" rel="noopener noreferrer" className="inline-flex underline text-[#bafcfc]">Open Square dashboard</a>
        </div>
      </SectionCard>
    </div>
  </AppShell>;
}
