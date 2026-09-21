"use client";

import { Sparkles, SpellCheck } from "lucide-react";
import { useState, useTransition } from "react";

import { rewriteQuoteTextAction } from "@/lib/chillbros/text-assist-actions";

export function AiTextAssist({ getValue, setValue, disabled }: { getValue: () => string; setValue: (next: string) => void; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(mode: "professional" | "grammar") {
    setError(null);
    const current = getValue();
    startTransition(async () => {
      const result = await rewriteQuoteTextAction(current, mode);
      if (!result.ok) { setError(result.error); return; }
      setValue(result.data);
    });
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => run("professional")} disabled={disabled || pending} className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d7dff]/25 px-2.5 py-1.5 text-xs text-[#d9fbff] transition hover:border-[#8ffafa]/45 disabled:opacity-40">
        <Sparkles className="h-3.5 w-3.5" />
        {pending ? "Rewriting…" : "Make more professional"}
      </button>
      <button type="button" onClick={() => run("grammar")} disabled={disabled || pending} className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d7dff]/25 px-2.5 py-1.5 text-xs text-[#d9fbff] transition hover:border-[#8ffafa]/45 disabled:opacity-40">
        <SpellCheck className="h-3.5 w-3.5" />
        Fix grammar
      </button>
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
    </div>
  );
}
