"use client";

import { useState, useTransition } from "react";
import { lookupParts, type PartsLookupResult } from "@/app/parts-lookup/actions";

const input = "min-h-12 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 py-2.5 text-white placeholder:text-zinc-600";
const label = "text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400";

export function PartsLookupForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Extract<PartsLookupResult, { ok: true }> | null>(null);
  const [error, setError] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    setResult(null);
    startTransition(async () => {
      const outcome = await lookupParts(formData);
      if (!outcome.ok) { setError(outcome.error); return; }
      setResult(outcome);
    });
  }

  return <div className="space-y-4">
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Brand / manufacturer<input name="brand" required maxLength={120} placeholder="e.g. Carrier, True, Hoshizaki" className={`${input} mt-1`} /></label>
        <label className={label}>Model number<input name="model" required maxLength={120} placeholder="e.g. 48TCED08A2A6" className={`${input} mt-1`} /></label>
        <label className={label}>Serial number (optional)<input name="serial" maxLength={120} placeholder="Improves accuracy if known" className={`${input} mt-1`} /></label>
        <label className={label}>What part / symptom (optional)<input name="details" maxLength={300} placeholder="e.g. compressor not starting, hums then trips" className={`${input} mt-1`} /></label>
      </div>
      <button disabled={pending} className="min-h-12 w-full rounded-2xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto sm:px-8">
        {pending ? "Looking up…" : "Look up OEM parts"}
      </button>
    </form>

    {error ? <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p> : null}

    {result ? <div className="rounded-2xl border border-[#2d7dff]/25 bg-black/40 p-4 sm:p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">AI-drafted starting point — verify every part number before ordering</p>
      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-zinc-200">{result.data}</pre>
      {result.partsDepartmentContact ? <div className="mt-4 rounded-xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8ffafa]">Couldn&apos;t source the exact number — call the parts department</p>
        <p className="mt-1 text-sm text-white">{result.partsDepartmentContact.brand}: <a href={`tel:${result.partsDepartmentContact.phone.replace(/[^\d+]/g, "")}`} className="font-semibold underline">{result.partsDepartmentContact.phone}</a></p>
        {result.partsDepartmentContact.note ? <p className="mt-1 text-xs text-zinc-400">{result.partsDepartmentContact.note}</p> : null}
      </div> : null}
    </div> : null}
  </div>;
}
