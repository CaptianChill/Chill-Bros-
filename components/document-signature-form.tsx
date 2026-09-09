"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";

import { approveEstimateLifecycleAction } from "@/lib/chillbros/job-lifecycle-actions";
import { acceptServiceAgreementAndNotifyAction } from "@/lib/chillbros/service-agreement-approval";

type Props = {
  kind: "estimate" | "agreement";
  token: string;
  initialSignature: string | null;
  initialSignedAt: string | null;
  alreadyApproved: boolean;
};

export function DocumentSignatureForm({ kind, token, initialSignature, initialSignedAt, alreadyApproved }: Props) {
  const router = useRouter();
  const [signature, setSignature] = useState(initialSignature ?? "");
  const [approved, setApproved] = useState(alreadyApproved);
  const [signedAt, setSignedAt] = useState(initialSignedAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (signature.trim().length < 2) { setError("Enter the signer name."); return; }
    setError(null);
    startTransition(async () => {
      const result = kind === "estimate" ? await approveEstimateLifecycleAction(token, signature) : await acceptServiceAgreementAndNotifyAction(token, signature);
      if (!result.ok) { setError(result.error); return; }
      setApproved(true);
      setSignedAt(new Date().toISOString());
      router.refresh();
    });
  };

  if (approved) return <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4"><div className="flex items-center gap-2 font-semibold text-emerald-800"><BadgeCheck className="h-5 w-5" />Signed & approved</div><p className="mt-2 text-sm text-zinc-800">Signed by <span className="font-semibold">{signature}</span></p>{signedAt ? <p className="mt-1 text-xs text-zinc-500">{new Date(signedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p> : null}</div>;

  return <div className="rounded-xl border border-zinc-300 bg-zinc-50 p-4 print:border-0 print:bg-white print:p-0">
    <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">Customer signature</span><input value={signature} onChange={(e) => setSignature(e.target.value)} autoComplete="name" placeholder="Type full name" className="mt-2 w-full rounded-lg border border-zinc-400 bg-white px-3 py-3 text-base text-zinc-950 outline-none focus:border-blue-600 print:border-0 print:border-b print:rounded-none" /></label>
    {error ? <p className="mt-2 text-xs font-medium text-rose-700">{error}</p> : null}
    <button type="button" onClick={submit} disabled={pending} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 print:hidden"><BadgeCheck className="h-4 w-4" />{pending ? "Saving…" : kind === "estimate" ? "Sign & approve" : "Sign & accept plan"}</button>
  </div>;
}
