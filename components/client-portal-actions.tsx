"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BadgeCheck, FileText, Printer } from "lucide-react";

import { approveEstimateLifecycleAction } from "@/lib/chillbros/job-lifecycle-actions";
import { PaymentMethodTabs, type ManualPaymentSettings } from "@/components/payment-method-tabs";
import { type Invoice } from "@/lib/chillbros/types";
import { StatusPill } from "@/components/status-pill";

export function ClientPortalActions({
  invoice,
  amountDue = 0,
  paymentSettings,
}: {
  invoice: Invoice;
  amountDue?: number;
  paymentSettings: ManualPaymentSettings;
}) {
  const [signature, setSignature] = useState(invoice.signatureName ?? "");
  const [approved, setApproved] = useState(invoice.status === "approved");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const invoiceIssued = Boolean(invoice.issuedAt);
  const paid = invoice.paymentStatus === "paid";
  const status = paid ? "Paid • receipt available" : invoiceIssued ? "Invoice ready • payment due" : approved ? "Approved • work pending" : "Awaiting signature approval";

  const handleApprove = () => {
    if (signature.trim().length < 2) { setError("Type your name to sign."); return; }
    setError(null);
    startTransition(async () => {
      const result = await approveEstimateLifecycleAction(invoice.portalToken, signature);
      if (!result.ok) { setError(result.error); return; }
      setApproved(true);
    });
  };

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

    {approved && invoiceIssued && !paid ? <PaymentMethodTabs token={invoice.portalToken} amountDue={amountDue} invoiceNumber={invoice.invoiceNumber} paymentStatus={invoice.paymentStatus} initialMethod={invoice.paymentMethod} settings={paymentSettings} /> : null}

    {paid ? <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/[0.07] p-5 text-center"><BadgeCheck className="mx-auto h-7 w-7 text-emerald-300" /><p className="mt-2 font-semibold text-white">Payment complete</p><p className="mt-1 text-sm text-zinc-400">Your paid receipt is available from this secure page.</p></div> : null}

    <div className="grid gap-2 sm:grid-cols-2"><Link href={`/portal/${invoice.portalToken}/document`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 px-4 py-3 text-sm text-white"><FileText className="h-4 w-4" />Fullscreen document</Link><button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 px-4 py-3 text-sm text-white"><Printer className="h-4 w-4" />Print / save</button></div>
  </div>;
}
