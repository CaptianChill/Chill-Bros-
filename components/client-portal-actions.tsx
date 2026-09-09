"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BadgeCheck, CreditCard, FileText, Printer, ShieldCheck, Wallet } from "lucide-react";

import { approveEstimateLifecycleAction, setIssuedInvoicePaymentMethodAction } from "@/lib/chillbros/job-lifecycle-actions";
import type { PaymentSettings } from "@/lib/chillbros/payment-settings";
import { PAYMENT_METHOD_LABELS, type Invoice, type PaymentMethod } from "@/lib/chillbros/types";
import { StatusPill } from "@/components/status-pill";

const PAYMENT_METHODS: PaymentMethod[] = ["cash", "check", "ach", "cash_app", "venmo", "zelle"];
const EMPTY_SETTINGS: PaymentSettings = { stripeEnabled: false, zelleContact: "", cashAppHandle: "", venmoHandle: "", checkPayableTo: "", manualAchInstructions: "", customerPaymentNote: "" };

export function ClientPortalActions({
  invoice,
  paymentSettings = EMPTY_SETTINGS,
  stripeOnline = false,
  amountDue = 0,
}: {
  invoice: Invoice;
  paymentSettings?: PaymentSettings;
  stripeOnline?: boolean;
  amountDue?: number;
}) {
  const [signature, setSignature] = useState(invoice.signatureName ?? "");
  const [approved, setApproved] = useState(invoice.status === "approved");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(invoice.paymentMethod);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const invoiceIssued = Boolean(invoice.issuedAt);
  const paid = invoice.paymentStatus === "paid";
  const money = amountDue.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const status = paid ? "Paid • receipt available" : invoiceIssued ? "Invoice ready • payment due" : approved ? "Approved • work pending" : "Awaiting signature approval";

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
    startTransition(async () => {
      const result = await approveEstimateLifecycleAction(invoice.portalToken, signature);
      if (!result.ok) { setError(result.error); return; }
      setApproved(true);
    });
  };

  const handlePaymentMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setError(null);
    startTransition(async () => {
      const result = await setIssuedInvoicePaymentMethodAction(invoice.portalToken, method);
      if (!result.ok) setError(result.error);
    });
  };

  const paymentInstruction = paymentMethod === "zelle" && paymentSettings.zelleContact ? <>Send with Zelle to <strong className="text-white">{paymentSettings.zelleContact}</strong>.</>
    : paymentMethod === "cash_app" && paymentSettings.cashAppHandle ? <>Send with Cash App to <strong className="text-white">{paymentSettings.cashAppHandle}</strong>.</>
    : paymentMethod === "venmo" && paymentSettings.venmoHandle ? <>Send with Venmo to <strong className="text-white">{paymentSettings.venmoHandle}</strong>.</>
    : paymentMethod === "check" && paymentSettings.checkPayableTo ? <>Make the check payable to <strong className="text-white">{paymentSettings.checkPayableTo}</strong>.</>
    : paymentMethod === "ach" && paymentSettings.manualAchInstructions ? <span className="whitespace-pre-wrap">{paymentSettings.manualAchInstructions}</span>
    : paymentMethod === "cash" ? <>Coordinate cash payment directly with Chill Bros.</>
    : null;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><StatusPill tone={paid || approved ? "emerald" : "amber"}>{status}</StatusPill><StatusPill>Secure client link</StatusPill></div>
    {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

    {!approved ? <div className="space-y-3">
      <label className="block space-y-2"><span className="text-sm text-zinc-300">Digital signature</span><input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type signer name" className="w-full rounded-2xl border border-[#2d7dff]/30 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-500" /></label>
      <button type="button" onClick={handleApprove} disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/55 bg-[#2d7dff]/20 px-4 py-3 font-semibold text-white disabled:opacity-60"><BadgeCheck className="h-4 w-4" />Approve & sign estimate</button>
      <p className="text-xs leading-5 text-zinc-500">Approval authorizes the quoted work. It does not create a final bill before the work is completed.</p>
    </div> : null}

    {approved && !invoiceIssued && !paid ? <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.06] p-5">
      <div className="flex items-start gap-3"><BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><h3 className="font-semibold text-white">Estimate approved</h3><p className="mt-1 text-sm leading-6 text-zinc-400">Chill Bros will complete the approved work or schedule the return visit. There is no final invoice to pay yet.</p></div></div>
    </div> : null}

    {invoiceIssued && !paid ? <div className="space-y-3 rounded-3xl border border-[#8ffafa]/30 bg-[#06111b]/70 p-4 sm:p-5">
      <div className="flex items-start gap-3"><CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-[#8ffafa]" /><div className="min-w-0 flex-1"><h3 className="font-semibold text-white">Pay invoice</h3><p className="mt-1 text-sm leading-6 text-zinc-400">Amount due: <strong className="text-white">{money}</strong>. Secure online payment is the fastest option.</p></div></div>

      {stripeOnline ? <form method="post" action="/api/payments/stripe/checkout" data-no-draft="true"><input type="hidden" name="token" value={invoice.portalToken} /><button type="submit" className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/70 bg-[#2d7dff] px-4 py-3 text-base font-bold text-white shadow-[0_0_26px_rgba(45,125,255,0.24)]"><ShieldCheck className="h-5 w-5" />Pay {money} securely</button><p className="mt-2 text-center text-xs text-zinc-500">Card or bank account through secure checkout.</p></form> : <p className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100">Secure online checkout is not enabled yet. Use one of the available payment methods below.</p>}

      {availableMethods.length > 0 ? <details className="rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-4"><summary className="cursor-pointer text-sm font-semibold text-zinc-200">Other ways to pay</summary><div className="mt-4 grid gap-2 sm:grid-cols-2">{availableMethods.map((method) => {
        const selected = paymentMethod === method;
        return <button key={method} type="button" onClick={() => handlePaymentMethod(method)} disabled={pending} aria-pressed={selected} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition disabled:opacity-60 ${selected ? "border-[#8ffafa]/70 bg-[#2d7dff]/20 text-white" : "border-[#2d7dff]/20 bg-black/40 text-zinc-300"}`}><span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-black ${selected ? "border-[#8ffafa] bg-[#8ffafa] text-black" : "border-zinc-600 bg-black text-transparent"}`}>✓</span><span className="font-medium">{PAYMENT_METHOD_LABELS[method]}</span></button>;
      })}</div>{paymentInstruction ? <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-3 text-sm leading-6 text-emerald-100"><div>{paymentInstruction}</div>{paymentSettings.customerPaymentNote ? <p className="mt-2 border-t border-emerald-400/15 pt-2 text-xs text-zinc-400">{paymentSettings.customerPaymentNote}</p> : null}</div> : null}</details> : null}
    </div> : null}

    {paid ? <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/[0.07] p-5 text-center"><BadgeCheck className="mx-auto h-7 w-7 text-emerald-300" /><p className="mt-2 font-semibold text-white">Payment complete</p><p className="mt-1 text-sm text-zinc-400">Your paid receipt is available from this secure page.</p></div> : null}

    <div className="grid gap-2 sm:grid-cols-2"><Link href={`/portal/${invoice.portalToken}/document`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 px-4 py-3 text-sm text-white"><FileText className="h-4 w-4" />Fullscreen document</Link><button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 px-4 py-3 text-sm text-white"><Printer className="h-4 w-4" />Print / save</button></div>
    {invoiceIssued && !paid && paymentMethod ? <p className="text-xs text-zinc-500">Selected manual method: <span className="text-[#bafcfc]">{PAYMENT_METHOD_LABELS[paymentMethod]}</span>. Manual payments remain pending until Chill Bros confirms receipt.</p> : null}
  </div>;
}
