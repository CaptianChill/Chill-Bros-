"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Mail, Wallet } from "lucide-react";

import { paymentOptions } from "@/lib/mock-data";
import { StatusPill } from "@/components/status-pill";

export function ClientPortalActions() {
  const [signature, setSignature] = useState("");
  const [approved, setApproved] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(paymentOptions[0]);

  const status = useMemo(() => {
    if (approved) {
      return "Approved • manager dashboard and chillbrostx@gmail.com notified";
    }

    return "Awaiting signature approval";
  }, [approved]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={approved ? "emerald" : "amber"}>{status}</StatusPill>
        <StatusPill>Secure client link</StatusPill>
      </div>

      <label className="block space-y-2">
        <span className="text-sm text-zinc-300">Digital signature</span>
        <input
          value={signature}
          onChange={(event) => setSignature(event.target.value)}
          placeholder="Type signer name"
          className="w-full rounded-2xl border border-[#00f0f0]/30 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        {paymentOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setPaymentMethod(option)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${paymentMethod === option ? "border-[#61f7f7] bg-[#00f0f0]/10 text-[#defefe]" : "border-[#00f0f0]/20 bg-black/40 text-zinc-300 hover:bg-[#00f0f0]/10"}`}
          >
            <span className="inline-flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {option}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setApproved(Boolean(signature.trim()))}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#61f7f7] bg-[#00f0f0]/10 px-4 py-3 font-medium text-[#defefe] transition hover:bg-[#00f0f0]/20"
        >
          <BadgeCheck className="h-4 w-4" />
          Approve & sign
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#00f0f0]/30 px-4 py-3 text-white transition hover:bg-[#00f0f0]/10"
        >
          <Mail className="h-4 w-4" />
          Send digital link to client
        </button>
      </div>

      <p className="text-sm text-zinc-400">Selected payment method: <span className="text-[#bafcfc]">{paymentMethod}</span></p>
    </div>
  );
}
