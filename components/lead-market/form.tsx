"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
export type MarketResult = { ok: boolean; error?: string; notice?: string; redirect?: string };
export function MarketForm({ action, children, submit, className = "space-y-4" }: { action: (form: FormData) => Promise<MarketResult>; children?: ReactNode; submit: string; className?: string }) {
  const [result, setResult] = useState<MarketResult | null>(null);
  const [pending, start] = useTransition(); const router = useRouter();
  return <form className={className} onSubmit={(event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setResult(null);
    start(async () => {
      try {
        const response = await action(data); setResult(response);
        if (response.redirect) {
          if (response.redirect.startsWith("/") && !response.redirect.startsWith("//")) router.push(response.redirect);
          else if (/^https:\/\/(square\.link|checkout\.square\.site|connect\.squareupsandbox\.com|squareup\.com)\//.test(response.redirect)) window.location.assign(response.redirect);
          else { setResult({ ok: false, error: "Unexpected destination. Contact support." }); return; }
        }
        if (response.ok) router.refresh();
      } catch { setResult({ ok: false, error: "Request could not be completed. Please retry." }); }
    });
  }}>
    <fieldset disabled={pending} className="space-y-3">{children}</fieldset>
    {result?.error ? <p role="alert" className="rounded-xl border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-100">{result.error}</p> : null}
    {result?.notice ? <p role="status" className="text-sm text-cyan-100">{result.notice}</p> : null}
    <button disabled={pending} className="min-h-11 rounded-xl bg-cyan-200 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{pending ? "Working…" : submit}</button>
  </form>;
}
