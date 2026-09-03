"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, Mail, Wallet } from "lucide-react";

import { approveInvoiceAction, setInvoicePaymentMethodAction } from "@/lib/chillbros/mutations";
import { PAYMENT_METHOD_LABELS, type Invoice, type PaymentMethod } from "@/lib/chillbros/types";
import { StatusPill } from "@/components/status-pill";

const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

export function ClientPortalActions({ invoice }: { invoice: Invoice }) {
  const [signature, setSignature] = useState("");
  const [approved, setApproved] = useState(invoice.status === "approved");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(invoice.paymentMethod);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const status = approved ? "Approved • manager dashboard and chillbrostx@gmail.com notified" : "Awaiting signature approval";

  const handleApprove = () => {
    if (!signature.trim()) {
      setError("Type your name to sign.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await approveInvoiceAction(invoice.portalToken, signature);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setApproved(true);
    });
  };

  const handlePaymentMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    startTransition(async () => {
      const result = await setInvoicePaymentMethodAction(invoice.portalToken, method);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={approved ? "emerald" : "amber"}>{status}</StatusPill>
        <StatusPill>Secure client link</StatusPill>
      </div>

      {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <label className="block space-y-2">
        <span className="text-sm text-zinc-300">Digital signature</span>
        <input
          value={signature}
          onChange={(event) => setSignature(event.target.value)}
          placeholder="Type signer name"
          disabled={approved}
          className="w-full rounded-2xl border border-[#2d7dff]/30 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 disabled:opacity-60"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        {PAYMENT_METHODS.map((method) => (
          <button
            key={method}
            type="button"
            onClick={() => handlePaymentMethod(method)}
            disabled={pending}
            className={`rounded-2xl border px-4 py-3 text-left text-sm transition disabled:opacity-60 ${paymentMethod === method ? "border-[#2d7dff] bg-[#2d7dff]/10 text-[#d9fbff]" : "border-[#2d7dff]/20 bg-black/40 text-zinc-300 hover:bg-[#2d7dff]/10"}`}
          >
            <span className="inline-flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {PAYMENT_METHOD_LABELS[method]}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={pending || approved}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] transition hover:bg-[#2d7dff]/20 disabled:opacity-60"
        >
          <BadgeCheck className="h-4 w-4" />
          {approved ? "Approved" : "Approve & sign"}
        </button>
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 px-4 py-3 text-white transition hover:bg-[#2d7dff]/10 disabled:opacity-60"
        >
          <Mail className="h-4 w-4" />
          Send digital link to client
        </button>
      </div>

      <p className="text-sm text-zinc-400">Selected payment method: <span className="text-[#bafcfc]">{paymentMethod ? PAYMENT_METHOD_LABELS[paymentMethod] : "None yet"}</span></p>
    </div>
  );
}
