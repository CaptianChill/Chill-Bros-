"use client";

import { useMemo, useState, useTransition } from "react";
import { Clock3, MapPin } from "lucide-react";

import { clockInResilientAction, clockOutResilientAction } from "@/lib/chillbros/timesheet-operations";
import { StatusPill } from "@/components/status-pill";
import type { OpenTimesheet } from "@/lib/chillbros/operations-queries";

export function TimesheetPanel({ initialOpen }: { initialOpen: OpenTimesheet | null }) {
  const [timesheetId, setTimesheetId] = useState<string | null>(initialOpen?.id ?? null);
  const [clockedInAt, setClockedInAt] = useState(initialOpen ? new Date(initialOpen.clockInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
  const [clockedOutAt, setClockedOutAt] = useState("");
  const [location, setLocation] = useState(initialOpen?.location ?? "");
  const [laborTime, setLaborTime] = useState("0");
  const [driveTime, setDriveTime] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = useMemo(() => (Number(laborTime || 0) + Number(driveTime || 0)).toFixed(1), [driveTime, laborTime]);

  const handleClockIn = () => {
    setError(null);
    startTransition(async () => {
      const result = await clockInResilientAction(location);
      if (!result.ok) { setError(result.error); return; }
      setTimesheetId(result.data.timesheetId);
      setClockedInAt(new Date(result.data.clockInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setLocation(result.data.location ?? location);
      setClockedOutAt("");
    });
  };

  const handleClockOut = () => {
    if (!timesheetId) { setError("Clock in first."); return; }
    setError(null);
    startTransition(async () => {
      const result = await clockOutResilientAction(timesheetId, Number(laborTime || 0), Number(driveTime || 0));
      if (!result.ok) { setError(result.error); return; }
      setClockedOutAt(new Date(result.data.clockOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setTimesheetId(null);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2"><StatusPill tone={timesheetId ? "emerald" : "cyan"}>{timesheetId ? `Clocked in ${clockedInAt}` : clockedOutAt ? `Clocked out ${clockedOutAt}` : "Not clocked in"}</StatusPill>{timesheetId ? <StatusPill tone="amber">Clock-out pending</StatusPill> : null}</div>
      {initialOpen ? <p className="rounded-xl border border-[#2d7dff]/20 bg-[#2d7dff]/5 px-3 py-2 text-xs text-[#bafcfc]">Open session restored from the database after page load.</p> : null}
      {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2"><label className="space-y-2"><span className="inline-flex items-center gap-2 text-sm text-zinc-300"><MapPin className="h-4 w-4 text-[#8ffafa]" />Job site / location</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Uses assigned job location if blank" disabled={Boolean(timesheetId)} className="w-full rounded-2xl border border-[#2d7dff]/30 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 disabled:opacity-60" /></label><div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><p className="text-sm text-zinc-400">Session allocation</p><p className="mt-2 text-3xl font-semibold text-white">{total} hrs</p><p className="mt-2 text-sm text-[#bafcfc]">Labor + drive hours saved on clock-out.</p></div></div>
      <div className="grid gap-4 md:grid-cols-2"><label className="space-y-2"><span className="text-sm text-zinc-300">Labor time</span><input type="number" min="0" step="0.25" value={laborTime} onChange={(event) => setLaborTime(event.target.value)} className="w-full rounded-2xl border border-[#2d7dff]/30 bg-black px-4 py-3 text-sm text-white outline-none" /></label><label className="space-y-2"><span className="text-sm text-zinc-300">Drive time</span><input type="number" min="0" step="0.25" value={driveTime} onChange={(event) => setDriveTime(event.target.value)} className="w-full rounded-2xl border border-[#2d7dff]/30 bg-black px-4 py-3 text-sm text-white outline-none" /></label></div>
      <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={handleClockIn} disabled={pending || Boolean(timesheetId)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] disabled:opacity-60"><Clock3 className="h-4 w-4" />Clock in</button><button type="button" onClick={handleClockOut} disabled={pending || !timesheetId} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 px-4 py-3 text-white disabled:opacity-60"><Clock3 className="h-4 w-4" />Clock out</button></div>
    </div>
  );
}
