"use client";

import { RefreshCw, Save } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const SAVE_ENABLED_PATHS = ["/technician", "/dispatch", "/manager"];

export function PageSyncControls() {
  const pathname = usePathname();
  const router = useRouter();
  const [saveRequested, setSaveRequested] = useState(false);
  const [pending, startTransition] = useTransition();
  const canSave = SAVE_ENABLED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  const save = () => {
    window.dispatchEvent(new CustomEvent("chillbros-save"));
    setSaveRequested(true);
    window.setTimeout(() => setSaveRequested(false), 1400);
  };

  const refresh = () => startTransition(() => router.refresh());

  return <div className="flex shrink-0 items-center gap-1.5">
    {canSave ? <button type="button" onClick={save} className="inline-flex items-center gap-1 rounded-full border border-[#2d7dff]/30 bg-[#2d7dff]/5 px-2 py-1 text-[10px] text-[#d9fbff] transition hover:bg-[#2d7dff]/15 sm:text-xs" title="Save editable fields on this page"><Save className="h-3 w-3" />{saveRequested ? "Save sent" : "Save"}</button> : null}
    <button type="button" onClick={refresh} disabled={pending} className="inline-flex items-center gap-1 rounded-full border border-[#2d7dff]/30 bg-[#2d7dff]/5 px-2 py-1 text-[10px] text-[#d9fbff] transition hover:bg-[#2d7dff]/15 disabled:opacity-50 sm:text-xs" title="Refresh live office and field data"><RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} />{pending ? "Refreshing" : "Refresh"}</button>
  </div>;
}
