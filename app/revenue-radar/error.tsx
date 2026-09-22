"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function RevenueRadarError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-4xl items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-rose-400/25 bg-[#020407]/95 p-6 text-center shadow-[0_0_28px_rgba(45,125,255,0.16)]">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-200" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">Revenue Radar</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">This did not save.</h1>
        <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-100">{error.message || "An unexpected error occurred."}</p>
        <p className="mt-3 text-sm leading-6 text-zinc-400">Nothing was saved. Fix the issue above, then go back and submit the form again.</p>
        <button type="button" onClick={reset} className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/45 bg-cyan-400/10 px-5 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"><RefreshCw className="h-4 w-4" />Back to the form</button>
      </div>
    </main>
  );
}
