"use client";

import { useState, useTransition } from "react";

import { setStaffPhoneAction } from "@/lib/chillbros/staff-phone-actions";

export function StaffPhoneField({ staffId, initial }: { staffId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = value.trim() !== saved.trim();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-2">Cell for work texts
        <input value={value} onChange={(e) => { setValue(e.target.value); setMsg(null); }} type="tel" inputMode="tel" placeholder="(210) 555-0123" className="w-40 rounded-lg border border-zinc-600 bg-black/50 px-2 py-1.5 text-white" />
      </label>
      {dirty ? <button type="button" disabled={pending} className="rounded-lg border border-[#2d7dff]/50 px-3 py-1.5" onClick={() => start(async () => { const r = await setStaffPhoneAction(staffId, value); if (!r.ok) { setMsg(r.error); return; } setValue(r.phone ?? ""); setSaved(r.phone ?? ""); setMsg("Saved."); })}>{pending ? "Saving…" : "Save"}</button> : null}
      {msg ? <span className={msg === "Saved." ? "text-emerald-300" : "text-amber-200"}>{msg}</span> : null}
    </div>
  );
}
