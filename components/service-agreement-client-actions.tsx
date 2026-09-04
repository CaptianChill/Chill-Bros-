"use client";

import Link from "next/link";
import { BadgeCheck, FileText } from "lucide-react";
import { useState, useTransition } from "react";

import { acceptServiceAgreementAction } from "@/lib/chillbros/service-agreement-actions";
import type { ServiceAgreement } from "@/lib/chillbros/service-agreement-queries";

export function ServiceAgreementClientActions({ agreement }: { agreement: ServiceAgreement }) {
  const [signature, setSignature] = useState(agreement.signatureName ?? "");
  const [accepted, setAccepted] = useState(["accepted", "active"].includes(agreement.status));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const accept = () => {
    if (signature.trim().length < 2) { setError("Type your name to accept the plan."); return; }
    setError(null);
    startTransition(async () => {
      const result = await acceptServiceAgreementAction(agreement.portalToken, signature);
      if (!result.ok) { setError(result.error); return; }
      setAccepted(true);
    });
  };

  return <div className="space-y-3">
    <Link href={`/agreement/${agreement.portalToken}/document`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 px-4 py-3 text-sm text-[#d9fbff]"><FileText className="h-4 w-4" />Open printable agreement</Link>
    <label className="block space-y-2"><span className="text-sm text-zinc-300">Customer acceptance signature</span><input value={signature} onChange={(e) => setSignature(e.target.value)} disabled={accepted} placeholder="Type signer name" className="w-full rounded-xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white disabled:opacity-60" /></label>
    {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    <button type="button" onClick={accept} disabled={pending || accepted} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100 disabled:opacity-60"><BadgeCheck className="h-4 w-4" />{accepted ? "Plan accepted" : "Accept monthly service plan"}</button>
    <p className="text-xs leading-5 text-zinc-500">Acceptance records the signer name and time against this specific saved plan. If the office later changes pricing or terms, the prior acceptance is cleared and the revised plan must be accepted again.</p>
  </div>;
}
