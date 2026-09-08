"use client";

import { useState, useTransition } from "react";
import { Check, Wallet } from "lucide-react";

import { setCustomerPaymentMethodAction } from "@/lib/chillbros/customer-payment-actions";
import type { PaymentSettings } from "@/lib/chillbros/payment-settings";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/chillbros/types";

const METHODS: PaymentMethod[] = ["cash", "check", "ach", "cash_app", "venmo", "zelle"];

export function DocumentPaymentMethods({ token, initialMethod, paymentStatus, paymentSettings }: { token: string; initialMethod: PaymentMethod | null; paymentStatus: string; paymentSettings: PaymentSettings }) {
  const [selected, setSelected] = useState<PaymentMethod | null>(initialMethod);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const available = METHODS.filter((method) => {
    if (method === "cash") return true;
    if (method === "check") return Boolean(paymentSettings.checkPayableTo);
    if (method === "ach") return Boolean(paymentSettings.manualAchInstructions);
    if (method === "cash_app") return Boolean(paymentSettings.cashAppHandle);
    if (method === "venmo") return Boolean(paymentSettings.venmoHandle);
    if (method === "zelle") return Boolean(paymentSettings.zelleContact);
    return false;
  });

  if (paymentStatus === "paid") return <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Payment received. Thank you.</div>;

  const choose = (method: PaymentMethod) => {
    setSelected(method);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await setCustomerPaymentMethodAction(token, method);
      if (!result.ok) { setError(result.error); return; }
      setMessage(`${PAYMENT_METHOD_LABELS[method]} selected.`);
    });
  };

  const instruction = selected === "zelle" && paymentSettings.zelleContact ? <>Send Zelle payment to <strong>{paymentSettings.zelleContact}</strong>.</>
    : selected === "cash_app" && paymentSettings.cashAppHandle ? <>Send Cash App payment to <strong>{paymentSettings.cashAppHandle}</strong>.</>
    : selected === "venmo" && paymentSettings.venmoHandle ? <>Send Venmo payment to <strong>{paymentSettings.venmoHandle}</strong>.</>
    : selected === "check" && paymentSettings.checkPayableTo ? <>Make check payable to <strong>{paymentSettings.checkPayableTo}</strong>.</>
    : selected === "ach" && paymentSettings.manualAchInstructions ? <span className="whitespace-pre-wrap">{paymentSettings.manualAchInstructions}</span>
    : selected === "cash" ? <>Coordinate cash payment directly with Chill Pros.</>
    : null;

  return <section className="rounded-2xl border-2 border-zinc-900 bg-white p-4 print:border-zinc-400">
    <div className="flex items-start gap-3"><Wallet className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-600">Payment</p><h3 className="mt-1 text-lg font-bold">Choose how you want to pay</h3><p className="mt-1 text-sm leading-6 text-zinc-600">Select one available method. Debit and credit cards are not enabled at this time.</p></div></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{available.map((method) => {
      const active = selected === method;
      return <button key={method} type="button" onClick={() => choose(method)} disabled={pending} aria-pressed={active} className={`print:hidden flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition disabled:opacity-50 ${active ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-600"}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${active ? "border-white bg-white text-zinc-950" : "border-zinc-400 text-transparent"}`}><Check className="h-4 w-4" /></span>{PAYMENT_METHOD_LABELS[method]}</button>;
    })}</div>
    <div className="hidden print:block mt-3 text-sm">Selected payment method: <strong>{selected ? PAYMENT_METHOD_LABELS[selected] : "Not selected"}</strong></div>
    {instruction ? <div className="mt-4 rounded-xl border border-zinc-300 bg-zinc-50 p-4 text-sm leading-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">Payment instructions</p><div className="mt-2">{instruction}</div>{paymentSettings.customerPaymentNote ? <p className="mt-3 border-t border-zinc-200 pt-3 text-xs text-zinc-600">{paymentSettings.customerPaymentNote}</p> : null}</div> : null}
    {message ? <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
    {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
  </section>;
}
