"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ScanForLeadsButton({ action }: { action: (form: FormData) => Promise<void> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        disabled={pending}
        className="min-h-12 whitespace-nowrap rounded-2xl bg-cyan-300 px-6 font-bold text-black shadow-[0_0_24px_rgba(103,232,249,0.28)] hover:bg-cyan-200 disabled:opacity-60"
        onClick={() => {
          setError("");
          startTransition(async () => {
            try {
              await action(new FormData());
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Scan failed. Try again.");
            }
          });
        }}
      >
        {pending ? "Scanning…" : "Scan for leads"}
      </button>
      {error ? <p role="alert" className="max-w-xs text-right text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
