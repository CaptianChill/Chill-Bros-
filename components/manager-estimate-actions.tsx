"use client";

import { useState, useTransition } from "react";
import { BadgeDollarSign, Ban, Copy } from "lucide-react";
import { useRouter } from "next/navigation";

import { markInvoicePaidAction, revokeEstimateAction } from "@/lib/chillbros/mutations";
import type { InvoiceStatus, PaymentStatus } from "@/lib/chillbros/types";

export function ManagerEstimateActions({
  invoiceId,
  portalToken,
  status,
  paymentStatus,
}: {
  invoiceId: string;
  portalToken: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const markPaid = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await markInvoicePaidAction(invoiceId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Payment recorded with manager audit trail.");
      router.refresh();
    });
  };

  const revoke = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await revokeEstimateAction(invoiceId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Estimate revoked. The customer link is now invalid.");
      router.refresh();
    });
  };

  const copyLink = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/portal/${portalToken}`);
      setMessage("Secure customer link copied.");
    } catch {
      setError("Could not copy the link on this device.");
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      {message ? <p className="text-xs text-emerald-300">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyLink}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff] transition hover:bg-[#2d7dff]/10 disabled:opacity-50"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy link
        </button>
        <button
          type="button"
          onClick={markPaid}
          disabled={pending || status !== "approved" || paymentStatus === "paid"}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 px-3 py-2 text-xs text-emerald-200 transition hover:bg-emerald-500/10 disabled:opacity-35"
        >
          <BadgeDollarSign className="h-3.5 w-3.5" />
          {paymentStatus === "paid" ? "Paid" : "Mark paid"}
        </button>
        <button
          type="button"
          onClick={revoke}
          disabled={pending || paymentStatus === "paid" || status === "void"}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 px-3 py-2 text-xs text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-35"
        >
          <Ban className="h-3.5 w-3.5" />
          Revoke estimate
        </button>
      </div>
    </div>
  );
}
