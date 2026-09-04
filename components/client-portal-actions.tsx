"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BadgeCheck, FileText, Printer, Wallet } from "lucide-react";

import { approveInvoiceV2Action, setInvoicePaymentMethodV2Action } from "@/lib/chillbros/estimate-actions-v2";
import { PAYMENT_METHOD_LABELS, type Invoice, type PaymentMethod } from "@/lib/chillbros/types";
import { StatusPill } from "@/components/status-pill";

const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

export function ClientPortalActions({ invoice }: { invoice: Invoice }) {
  const [signature, setSignature] = useState(invoice.signatureName ?? "");
  const [approved, setApproved] = useState(invoice.status === "approved");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(invoice.paymentMethod);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const status = invoice.paymentStatus === "paid" ? "Paid • receipt available" : approved ? "Approved • manager + dispatch updated" : "Awaiting signature approval";

  const handleApprove = () => {
    if (signature.trim().length < 2) { setError("Type your name to sign."); return; }
    setError(null);
    startTransition(async () => { const result = await approveInvoiceV2Action(invoice.portalToken, signature); if (!result.ok) { setError(result.error); return; } setApproved(true); });
  };

  const handlePaymentMethod = (method: PaymentMethod) => {
    setPaymentMethod(method); setError(null);
    startTransition(async () => { const result = await setInvoicePaymentMethodV2Action(invoice.portalToken, method); if (!result.ok) setError(result.error); });
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><StatusPill tone={invoice.paymentStatus === "paid" || approved ? "emerald" : "amber"}>{status}</StatusPill><StatusPill>Secure client link</StatusPill></div>
    {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
    <label className="block space-y-2"><span className="text-sm text-zinc-300">Digital signature</span><input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type signer name" disabled={approved} className="w-full rounded-2xl border border-[#2d7dff]/30 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-500 disabled:opacity-60" /></label>
    <button type="button" onClick={handleApprove} disabled={pending || approved} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] disabled:opacity-60"><BadgeCheck className="h-4 w-4" />{approved ? "Approved" : "Approve & sign estimate"}</button>
    <div className="space-y-2"><p className="text-sm text-zinc-300">Preferred payment method</p><div className="grid gap-2 md:grid-cols-2">{PAYMENT_METHODS.map((method) => <button key={method} type="button" onClick={() => handlePaymentMethod(method)} disabled={pending || invoice.paymentStatus === "paid"} className={`rounded-2xl border px-4 py-3 text-left text-sm transition disabled:opacity-60 ${paymentMethod === method ? "border-[#2d7dff] bg-[#2d7dff]/10 text-[#d9fbff]" : "border-[#2d7dff]/20 bg-black/40 text-zinc-300"}`}><span className="inline-flex items-center gap-2"><Wallet className="h-4 w-4" />{PAYMENT_METHOD_LABELS[method]}</span></button>)}</div></div>
    <p className="text-sm text-zinc-400">Selected method: <span className="text-[#bafcfc]">{paymentMethod ? PAYMENT_METHOD_LABELS[paymentMethod] : "None yet"}</span></p>
    <div className="grid gap-2 sm:grid-cols-2"><Link href={`/portal/${invoice.portalToken}/document`} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 px-4 py-3 text-sm text-white"><FileText className="h-4 w-4" />Fullscreen document</Link><button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 px-4 py-3 text-sm text-white"><Printer className="h-4 w-4" />Print / save</button></div>
    <p className="text-xs leading-5 text-zinc-500">Payment preference is recorded for office follow-up. Manual payments can be marked paid by a manager after receipt.</p>
  </div>;
}
