"use client";

import { RefreshCw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function PageSyncControls() {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () => {
    window.dispatchEvent(new CustomEvent("chillbros-save"));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };
  const refresh = () => startTransition(() => router.refresh());

  return <div className="flex shrink-0 items-center gap-1.5">
    <button type="button" onClick={save} className="inline-flex items-center gap-1 rounded-full border border-[#2d7dff]/30 bg-[#2d7dff]/5 px-2 py-1 text-[10px] text-[#d9fbff] sm:text-xs" title="Save editable fields on this page"><Save className="h-3 w-3" />{saved ? "Saved" : "Save"}</button>
    <button type="button" onClick={refresh} disabled={pending} className="inline-flex items-center gap-1 rounded-full border border-[#2d7dff]/30 bg-[#2d7dff]/5 px-2 py-1 text-[10px] text-[#d9fbff] disabled:opacity-50 sm:text-xs" title="Refresh live office and field data"><RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} />Refresh</button>
  </div>;
}
