"use client";

import { RefreshCw, Save } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

const SAVE_ENABLED_PATHS = ["/technician", "/dispatch", "/manager"];

export function PageSyncControls() {
  const pathname = usePathname();
  const [saveRequested, setSaveRequested] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const canSave = SAVE_ENABLED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  const save = () => {
    window.dispatchEvent(new CustomEvent("chillbros-save"));
    setSaveRequested(true);
    window.setTimeout(() => setSaveRequested(false), 1400);
  };

  const refresh = () => {
    setRefreshing(true);
    window.location.reload();
  };

  return <div className="flex shrink-0 items-center gap-1.5">
    {canSave ? <button type="button" onClick={save} className="inline-flex items-center gap-1 rounded-full border border-[#2d7dff]/30 bg-[#2d7dff]/5 px-2 py-1 text-[10px] text-[#d9fbff] transition hover:bg-[#2d7dff]/15 sm:text-xs" title="Save editable fields on this page"><Save className="h-3 w-3" />{saveRequested ? "Save sent" : "Save"}</button> : null}
    <button type="button" onClick={refresh} disabled={refreshing} className="inline-flex items-center gap-1 rounded-full border border-[#2d7dff]/30 bg-[#2d7dff]/5 px-2 py-1 text-[10px] text-[#d9fbff] transition hover:bg-[#2d7dff]/15 disabled:opacity-50 sm:text-xs" title="Reload the latest Chill Bros build and live data"><RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />{refreshing ? "Refreshing" : "Refresh"}</button>
  </div>;
}
