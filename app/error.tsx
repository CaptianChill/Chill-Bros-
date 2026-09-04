"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-4xl items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-rose-400/25 bg-[#020407]/95 p-6 text-center shadow-[0_0_28px_rgba(45,125,255,0.16)]">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-200" />
        <p className="mt-4 font-brand text-xs font-semibold uppercase tracking-[0.25em] text-[#8ffafa]">Chill Bros system notice</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">This page could not finish loading.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">Your saved operational data is not erased by this screen. Retry the page before repeating any customer, payment, inventory, or job action.</p>
        <button type="button" onClick={reset} className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/45 bg-[#2d7dff]/10 px-5 py-3 text-sm font-medium text-[#d9fbff] transition hover:bg-[#2d7dff]/20"><RefreshCw className="h-4 w-4" />Retry page</button>
      </div>
    </main>
  );
}
