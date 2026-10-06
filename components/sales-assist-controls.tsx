"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

// "Write with AI" submit button that shows progress while the AI drafts.
export function SalesAssistSubmit({ hasCard }: { hasCard: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="min-h-11 w-full rounded-xl bg-cyan-300 px-4 font-bold text-black disabled:opacity-60 sm:w-auto">
      {pending ? "Writing… (about 20 seconds)" : hasCard ? "Rewrite with AI" : "Write with AI"}
    </button>
  );
}

// The intro email is a draft: copy it, or open it in your own email app to review and send.
export function SalesAssistEmail({ subject, body, to }: { subject: string; body: string; to: string | null }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked; the text is still on screen */ }
  };
  const mailto = `mailto:${to ? encodeURIComponent(to) : ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" onClick={copy} className="min-h-10 rounded-xl border border-cyan-300/50 px-3 text-sm font-semibold text-cyan-100">{copied ? "Copied" : "Copy email"}</button>
      <a href={mailto} className="inline-flex min-h-10 items-center rounded-xl border border-cyan-300/50 px-3 text-sm font-semibold text-cyan-100">Open in my email</a>
    </div>
  );
}
