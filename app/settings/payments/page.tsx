import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getPaymentSettings, stripeConfigured } from "@/lib/chillbros/payment-settings";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { savePaymentSettingsAction } from "./actions";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ success?: string; error?: string }> };
const field = "min-h-12 w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white";

export default async function PaymentSettingsPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");
  const [settings, params] = await Promise.all([getPaymentSettings(), searchParams]);
  const configured = stripeConfigured();

  return <AppShell title="Payments & Payouts" description="Connect secure online checkout and control the payment instructions customers see on Chill Bros invoices." highlight={<div className="space-y-2"><StatusPill tone={configured ? "emerald" : "amber"}>{configured ? "Stripe keys configured" : "Stripe keys still required"}</StatusPill><StatusPill tone={settings.stripeEnabled && configured ? "emerald" : "amber"}>{settings.stripeEnabled && configured ? "Online payments on" : "Online payments off"}</StatusPill></div>}>
    <div className="space-y-5">
      {params.success ? <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{params.success}</p> : null}
      {params.error ? <p className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{params.error}</p> : null}

      <SectionCard eyebrow="Online payments" title="Stripe connection" description="Your bank account and routing number belong in Stripe, not in the Chill Bros database. Stripe handles cards, Apple Pay, and ACH payouts securely.">
        <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-sm text-zinc-300">
          <p>1. Connect or create your Stripe business account.</p>
          <p>2. In Stripe, add the Chill Bros business checking account under payout/bank settings.</p>
          <p>3. Add <code className="text-[#bafcfc]">STRIPE_SECRET_KEY</code> and <code className="text-[#bafcfc]">STRIPE_WEBHOOK_SECRET</code> to Vercel Production environment variables.</p>
          <p>4. Register this webhook endpoint in Stripe: <code className="text-[#bafcfc]">https://chill-bros.vercel.app/api/payments/stripe/webhook</code>.</p>
          <p className="text-zinc-500">The customer never sees your bank credentials. Stripe deposits cleared funds to the bank account you configure there.</p>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Customer-facing instructions" title="Payment methods shown on invoices" description="Save handles and instructions customers may use when they are not paying through Stripe.">
        <form action={savePaymentSettingsAction} className="space-y-4">
          <label className="flex items-start gap-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><input type="checkbox" name="stripeEnabled" defaultChecked={settings.stripeEnabled} className="mt-1 h-5 w-5" /><span><span className="block font-medium text-white">Accept online payments</span><span className="mt-1 block text-sm text-zinc-400">Shows a Pay Securely button only when Stripe server keys are also configured.</span></span></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-zinc-300">Zelle email / phone<input name="zelleContact" defaultValue={settings.zelleContact} className={`${field} mt-1`} placeholder="billing@company.com or phone" /></label>
            <label className="text-sm text-zinc-300">Cash App handle<input name="cashAppHandle" defaultValue={settings.cashAppHandle} className={`${field} mt-1`} placeholder="$ChillBros" /></label>
            <label className="text-sm text-zinc-300">Venmo handle<input name="venmoHandle" defaultValue={settings.venmoHandle} className={`${field} mt-1`} placeholder="@ChillBros" /></label>
            <label className="text-sm text-zinc-300">Checks payable to<input name="checkPayableTo" defaultValue={settings.checkPayableTo} className={`${field} mt-1`} /></label>
          </div>
          <label className="block text-sm text-zinc-300">Manual ACH / wire instructions<textarea name="manualAchInstructions" defaultValue={settings.manualAchInstructions} rows={3} className={`${field} mt-1`} placeholder="Recommended: Contact Chill Bros office for bank-transfer instructions. Do not store online-banking login credentials here." /></label>
          <label className="block text-sm text-zinc-300">General customer payment note<textarea name="customerPaymentNote" defaultValue={settings.customerPaymentNote} rows={3} className={`${field} mt-1`} placeholder="Payment is due according to the terms shown above." /></label>
          <button type="submit" className="min-h-12 w-full rounded-2xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-5 py-3 font-semibold text-[#d9fbff]">Save Payment Settings</button>
        </form>
      </SectionCard>
    </div>
  </AppShell>;
}
