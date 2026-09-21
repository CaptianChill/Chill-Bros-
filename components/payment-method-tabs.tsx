"use client";

import { useState, useTransition } from "react";

import { setCustomerPaymentMethodAction } from "@/lib/chillbros/customer-payment-actions";
import { SQUARE_PAYMENT_URL, squarePaymentAvailable } from "@/lib/chillbros/square-payment";
import type { PaymentMethod } from "@/lib/chillbros/types";

export type ManualPaymentSettings = {
  zelleContact: string;
  venmoHandle: string;
  chimeHandle: string;
  checkPayableTo: string;
  checkMailingAddress: string;
};

const TABS: { key: PaymentMethod; label: string }[] = [
  { key: "card", label: "Debit / Credit Card" },
  { key: "zelle", label: "Zelle" },
  { key: "venmo", label: "Venmo" },
  { key: "chime", label: "Chime" },
  { key: "check", label: "Check" },
  { key: "cash", label: "Cash" },
];

export function PaymentMethodTabs({ token, amountDue, invoiceNumber, paymentStatus, initialMethod, settings, document: printable = false }: {
  token: string;
  amountDue: number;
  invoiceNumber: string;
  paymentStatus: string;
  initialMethod: PaymentMethod | null;
  settings: ManualPaymentSettings;
  document?: boolean;
}) {
  const money = amountDue.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const startTab = TABS.some((tab) => tab.key === initialMethod) ? (initialMethod as PaymentMethod) : "card";
  const [active, setActive] = useState<PaymentMethod>(startTab);
  const [selected, setSelected] = useState<PaymentMethod | null>(initialMethod);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (paymentStatus === "paid") {
    return <div className={printable ? "rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800" : "rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-100"}>Payment received. Thank you.</div>;
  }

  function choose(method: PaymentMethod) {
    setMessage(""); setError("");
    startTransition(async () => {
      try {
        const result = await setCustomerPaymentMethodAction(token, method);
        if (!result.ok) { setError(result.error); return; }
        setSelected(method);
        setMessage("Payment choice saved. Chill Pros will confirm when payment is received.");
      } catch { setError("Could not save your payment choice. Please try again."); }
    });
  }

  const shell = printable ? "space-y-4 rounded-2xl border-2 border-zinc-900 bg-white p-4 text-zinc-900 sm:p-5" : "space-y-4 rounded-3xl border border-[#8ffafa]/30 bg-[#06111b]/70 p-5 text-white";
  const tabIdle = printable ? "border-zinc-300 text-zinc-600" : "border-[#2d7dff]/25 text-zinc-400";
  const tabActive = printable ? "border-zinc-900 bg-zinc-900 text-white" : "border-[#8ffafa]/60 bg-[#2d7dff]/20 text-white";
  const panel = printable ? "rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6" : "rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6";
  const buttonIdle = printable ? "border-zinc-900 text-zinc-900" : "border-[#8ffafa]/50 text-white";

  function manualPanel(label: string, method: PaymentMethod, configured: boolean, instructions: string) {
    if (!configured) return <p>{label} isn&apos;t set up yet. Contact Chill Pros directly, or choose another option above.</p>;
    return <div className="space-y-3">
      <p>{instructions}</p>
      <button type="button" disabled={pending} onClick={() => choose(method)} className={`inline-flex min-h-12 w-full items-center justify-center rounded-2xl border px-4 py-3 font-semibold disabled:opacity-50 ${buttonIdle}`}>
        {selected === method ? `Marked as paying by ${label}` : `I'm paying by ${label}`}
      </button>
    </div>;
  }

  return <section className={shell}>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-lg font-bold">Pay this invoice</h3>
      <p className="text-sm">Invoice {invoiceNumber} &middot; Amount due: <strong>{money}</strong></p>
    </div>

    <div className="flex flex-wrap gap-2" role="tablist">
      {TABS.map((tab) => <button key={tab.key} type="button" role="tab" aria-selected={active === tab.key} onClick={() => setActive(tab.key)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${active === tab.key ? tabActive : tabIdle}`}>
        {tab.label}{selected === tab.key ? " ✓" : ""}
      </button>)}
    </div>

    {message ? <p role="status" className={printable ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-emerald-300"}>{message}</p> : null}
    {error ? <p role="alert" className={printable ? "text-sm font-medium text-rose-700" : "text-sm font-medium text-rose-300"}>{error}</p> : null}

    <div className={panel}>
      {active === "card" ? (
        squarePaymentAvailable(amountDue) ? <div className="space-y-3">
          <p>Enter {money} in Square and use the name and email from your invoice so we can match your payment.</p>
          <a href={SQUARE_PAYMENT_URL} target="_blank" rel="noopener noreferrer" className="print:hidden inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#2d7dff] px-4 py-3 font-bold text-white">Pay with Square<span className="sr-only"> (opens in a new tab)</span></a>
          <p className="hidden break-all text-sm print:block">Pay online: {SQUARE_PAYMENT_URL}</p>
          <p className="text-xs opacity-80">Your invoice stays unpaid here until Chill Pros confirms your Square payment. If you have already paid, keep your Square receipt and contact us before paying again.</p>
        </div> : <p>Contact Chill Pros to settle this invoice. This amount cannot be paid through the shared Square link.</p>
      ) : active === "zelle" ? manualPanel("Zelle", "zelle", Boolean(settings.zelleContact.trim()), `Send ${money} via Zelle to ${settings.zelleContact}. Include invoice ${invoiceNumber} in the memo.`)
      : active === "venmo" ? manualPanel("Venmo", "venmo", Boolean(settings.venmoHandle.trim()), `Send ${money} on Venmo to ${settings.venmoHandle}. Include invoice ${invoiceNumber} in the note.`)
      : active === "chime" ? manualPanel("Chime", "chime", Boolean(settings.chimeHandle.trim()), `Send ${money} via Chime to ${settings.chimeHandle}. Include invoice ${invoiceNumber} in the note.`)
      : active === "check" ? manualPanel("Check", "check", true, `Make checks payable to ${settings.checkPayableTo || "Chill Professionals LLC"}.${settings.checkMailingAddress ? ` Mail or drop off at: ${settings.checkMailingAddress}.` : " Ask Chill Pros where to send it."}`)
      : manualPanel("Cash", "cash", true, "Pay Chill Pros directly in cash and get a receipt at the time of payment.")}
    </div>

    <p className="text-xs opacity-70">Selecting Zelle, Venmo, Chime, check, or cash tells our office how you&apos;re paying. It does not mark this invoice paid until Chill Pros confirms the payment was received.</p>
  </section>;
}
