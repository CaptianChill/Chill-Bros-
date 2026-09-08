"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BadgeCheck, FileText, Printer, Wallet } from "lucide-react";

import { approveInvoiceV2Action, setInvoicePaymentMethodV2Action } from "@/lib/chillbros/estimate-actions-v2";
import type { PaymentSettings } from "@/lib/chillbros/payment-settings";
import { PAYMENT_METHOD_LABELS, type Invoice, type PaymentMethod } from "@/lib/chillbros/types";
import { StatusPill } from "@/components/status-pill";

const PAYMENT_METHODS: PaymentMethod[] = ["cash", "check", "ach", "cash_app", "venmo", "zelle"];
const EMPTY_SETTINGS: PaymentSettings = { stripeEnabled: false, zelleContact: "", cashAppHandle: "", venmoHandle: "", checkPayableTo: "", manualAchInstructions: "", customerPaymentNote: "" };

export function ClientPortalActions({ invoice, paymentSettings = EMPTY_SETTINGS }: { invoice: Invoice; paymentSettings?: PaymentSettings; stripeOnline?: boolean }) {
  const [signature, setSignature] = useState(invoice.signatureName ?? "");
  const [approved, setApproved] = useState(invoice.status === "approved");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(invoice.paymentMethod);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const status = invoice.paymentStatus === "paid" ? "Paid • receipt available" : approved ? "Approved • choose payment method" : "Awaiting signature approval";
  const availableMethods = PAYMENT_METHODS.filter((method) => {
    if (method === "cash") return true;
    if (method === "check") return Boolean(paymentSettings.checkPayableTo);
    if (method === "ach") return Boolean(paymentSettings.manualAchInstructions);
    if (method === "cash_app") return Boolean(paymentSettings.cashAppHandle);
    if (method === "venmo") return Boolean(paymentSettings.venmoHandle);
    if (method === "zelle") return Boolean(paymentSettings.zelleContact);
    return false;
  });

  const handleApprove = () => {
    if (signature.trim().length < 2) { setError("Type your name to sign."); return; }
    setError(null);
    startTransition(async () => { const result = await approveInvoiceV2Action(invoice.portalToken, signature); if (!result.ok) { setError(result.error); return; } setApproved(true); });
  };

  const handlePaymentMethod = (method: PaymentMethod) => {
    setPaymentMethod(method); setError(null);
    startTransition(async () => { const result = await setInvoicePaymentMethodV2Action(invoice.portalToken, method); if (!result.ok) setError(result.error); });
  };

  const paymentInstruction = paymentMethod === "zelle" && paymentSettings.zelleContact ? <>Send with Zelle to <strong className="text-white">{paymentSettings.zelleContact}</strong>.</>
    : paymentMethod === "cash_app" && paymentSettings.cashAppHandle ? <>Send with Cash App to <strong className="text-white">{paymentSettings.cashAppHandle}</strong>.</>
    : paymentMethod === "venmo" && paymentSettings.venmoHandle ? <>Send with Venmo to <strong className="text-white">{paymentSettings.venmoHandle}</strong>.</>
    : paymentMethod === "check" && paymentSettings.checkPayableTo ? <>Make the check payable to <strong className="text-white">{paymentSettings.checkPayableTo}</strong>.</>
    : paymentMethod === "ach" && paymentSettings.manualAchInstructions ? <span className="whitespace-pre-wrap">{paymentSettings.manualAchInstructions}</span>
    : paymentMethod === "cash" ? <>Coordinate cash payment directly with Chill Bros.</>
    : null;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><StatusPill tone={invoice.paymentStatus === "paid" || approved ? "emerald" : "amber"}>{status}</StatusPill><StatusPill>Secure client link</StatusPill></div>
    {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
    <label className="block space-y-2"><span className="text-sm text-zinc-300">Digital signature</span><input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type signer name" disabled={approved} className="w-full rounded-2xl border border-[#2d7dff]/30 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-500 disabled:opacity-60" /></label>
    <button type="button" onClick={handleApprove} disabled={pending || approved} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] disabled:opacity-60"><BadgeCheck className="h-4 w-4" />{approved ? "Approved" : "Approve & sign estimate"}</button>

    {approved && invoice.paymentStatus !== "paid" ? <div className="rounded-3xl border border-[#8ffafa]/30 bg-[#06111b]/70 p-4 sm:p-5">
      <div className="flex items-start gap-3"><Wallet className="mt-0.5 h-5 w-5 shrink-0 text-[#8ffafa]" /><div><h3 className="font-semibold text-white">Choose your payment method</h3><p className="mt-1 text-sm leading-6 text-zinc-400">Select the option you prefer. Only payment methods currently available through Chill Bros are shown.</p></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{availableMethods.map((method) => {
        const selected = paymentMethod === method;
        return <button key={method} type="button" onClick={() => handlePaymentMethod(method)} disabled={pending} aria-pressed={selected} className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition disabled:opacity-60 ${selected ? "border-[#8ffafa]/70 bg-[#2d7dff]/20 text-white shadow-[0_0_18px_rgba(45,125,255,0.16)]" : "border-[#2d7dff]/20 bg-black/40 text-zinc-300 hover:border-[#8ffafa]/35"}`}><span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm font-black ${selected ? "border-[#8ffafa] bg-[#8ffafa] text-black" : "border-zinc-600 bg-black text-transparent"}`}>✓</span><span className="font-medium">{PAYMENT_METHOD_LABELS[method]}</span></button>;
      })}</div>
      {paymentInstruction ? <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4 text-sm leading-6 text-emerald-100"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Payment instructions</p><div className="mt-2">{paymentInstruction}</div>{paymentSettings.customerPaymentNote ? <p className="mt-3 border-t border-emerald-400/15 pt-3 text-xs text-zinc-400">{paymentSettings.customerPaymentNote}</p> : null}</div> : null}
    </div> : null}

    <p className="text-sm text-zinc-400">Selected method: <span className="text-[#bafcfc]">{paymentMethod && availableMethods.includes(paymentMethod) ? PAYMENT_METHOD_LABELS[paymentMethod] : "None yet"}</span></p>
    <div className="grid gap-2 sm:grid-cols-2"><Link href={`/portal/${invoice.portalToken}/document`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 px-4 py-3 text-sm text-white"><FileText className="h-4 w-4" />Fullscreen document</Link><button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 px-4 py-3 text-sm text-white"><Printer className="h-4 w-4" />Print / save</button></div>
    <p className="text-xs leading-5 text-zinc-500">Manual payments remain pending until Chill Bros confirms receipt. Debit and credit card checkout is intentionally not shown right now.</p>
  </div>;
}
