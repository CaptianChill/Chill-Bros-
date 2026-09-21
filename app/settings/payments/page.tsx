import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { SQUARE_PAYMENT_URL } from "@/lib/chillbros/square-payment";
import { getPaymentSettings } from "@/lib/chillbros/payment-settings";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { sendTestEmailAction, updateManualPaymentSettingsAction } from "./actions";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ success?: string; error?: string }> };
const input = "min-h-12 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 py-2.5 text-white placeholder:text-zinc-600";
const label = "text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400";

export default async function PaymentSettingsPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");
  const params = await searchParams;
  const settings = await getPaymentSettings();
  const configuredCount = [settings.zelleContact, settings.venmoHandle, settings.chimeHandle].filter(Boolean).length;

  return <AppShell title="Payments & Payouts" description="Customers see these as tabs on their invoice: Debit/Credit Card (Square), Zelle, Venmo, Chime, Check, and Cash." highlight={<StatusPill tone="emerald">Square payment link configured</StatusPill>}>
    <div className="space-y-5">
      {params.success ? <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{params.success}</p> : null}
      {params.error ? <p className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{params.error}</p> : null}
      <form data-no-draft action={sendTestEmailAction}>
        <button type="submit" className="min-h-12 rounded-2xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-5 py-3 font-semibold text-[#d9fbff]">Send test email</button>
        <p className="mt-2 text-sm text-zinc-400">Sends to your signed-in email: {profile.email}</p>
      </form>

      <SectionCard eyebrow="Customer payments" title="Debit / Credit Card (Square)" description="Square is the card option shown in the customer's payment tabs.">
        <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-sm text-zinc-300">
          <a href={SQUARE_PAYMENT_URL} target="_blank" rel="noopener noreferrer" className="break-all text-[#bafcfc] underline">{SQUARE_PAYMENT_URL}</a>
          <p>Customers enter the invoice total in Square and use the name and email from their invoice. This shared link does not automatically fill in the amount or match a payment to an invoice.</p>
          <p>After confirming the completed payment, amount, and customer in your Square dashboard, open the matching invoice in Chill Pros and select Mark paid. Opening the link does not mark an invoice paid.</p>
          <a href="https://app.squareup.com/dashboard/payments" target="_blank" rel="noopener noreferrer" className="inline-flex underline text-[#bafcfc]">Open Square dashboard</a>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Customer payments" title="Zelle, Venmo, Chime & Check" description={`${configuredCount} of 3 handle-based options configured. A tab only shows real send-to instructions once you fill in its handle below — otherwise customers see "not set up yet".`}>
        <form data-no-draft action={updateManualPaymentSettingsAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Zelle contact (phone or email)<input name="zelleContact" defaultValue={settings.zelleContact} placeholder="e.g. 555-123-4567 or you@business.com" className={`${input} mt-1`} /></label>
            <label className={label}>Venmo handle<input name="venmoHandle" defaultValue={settings.venmoHandle} placeholder="e.g. @Chill-Pros" className={`${input} mt-1`} /></label>
            <label className={label}>Chime handle<input name="chimeHandle" defaultValue={settings.chimeHandle} placeholder="e.g. $ChillPros or phone number" className={`${input} mt-1`} /></label>
            <label className={label}>Checks payable to<input name="checkPayableTo" defaultValue={settings.checkPayableTo} placeholder="Chill Professionals LLC" className={`${input} mt-1`} /></label>
          </div>
          <label className={`${label} block`}>Where to mail or drop off a check<textarea name="checkMailingAddress" rows={2} defaultValue={settings.checkMailingAddress} placeholder="Street address, city, state, ZIP" className={`${input} mt-1 resize-y`} /></label>
          <button type="submit" className="min-h-12 w-full rounded-2xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-5 py-3 font-semibold text-[#d9fbff] sm:w-auto">Save payment options</button>
        </form>
      </SectionCard>
    </div>
  </AppShell>;
}
