"use client";

import { useState, useTransition } from "react";

import { unsubscribeAction } from "@/lib/chillbros/autopilot/unsubscribe-actions";

export function UnsubscribeButton({ contact, signature }: { contact: string; signature: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [pending, start] = useTransition();
  if (state === "done") return <p className="text-[17px] font-semibold text-[#1F8A4C]">You&apos;re unsubscribed. Chill Pros won&apos;t email you again.</p>;
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => start(async () => setState((await unsubscribeAction(contact, signature)).ok ? "done" : "error"))}
        className="h-12 w-full rounded-xl bg-[#05070A] px-6 text-base font-bold text-white disabled:opacity-60">{pending ? "Working…" : "Unsubscribe"}</button>
      {state === "error" ? <p className="mt-2 text-sm font-semibold text-[#B42318]">That link didn&apos;t work. Reply to any email with &quot;unsubscribe&quot; and we&apos;ll remove you.</p> : null}
    </div>
  );
}
