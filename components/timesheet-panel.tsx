"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Clock3, Coffee, MapPin, Play, Square } from "lucide-react";

import { clockInResilientAction, clockOutResilientAction, endBreakAction, startBreakAction } from "@/lib/chillbros/timesheet-operations";
import { StatusPill } from "@/components/status-pill";
import type { OpenTimesheet } from "@/lib/chillbros/operations-queries";

function durationLabel(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function TimesheetPanel({ initialOpen }: { initialOpen: OpenTimesheet | null }) {
  const [timesheetId, setTimesheetId] = useState<string | null>(initialOpen?.id ?? null);
  const [clockInIso, setClockInIso] = useState(initialOpen?.clockInAt ?? "");
  const [clockedOutAt, setClockedOutAt] = useState("");
  const [location, setLocation] = useState(initialOpen?.location ?? "");
  const [laborTime, setLaborTime] = useState("0");
  const [driveTime, setDriveTime] = useState("0");
  const [breakStartedAt, setBreakStartedAt] = useState<string | null>(initialOpen?.breakStartedAt ?? null);
  const [breakMinutes, setBreakMinutes] = useState(initialOpen?.breakMinutes ?? 0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const fullDayMs = timesheetId && clockInIso ? now - new Date(clockInIso).getTime() : 0;
  const currentBreakMs = breakStartedAt ? Math.max(0, now - new Date(breakStartedAt).getTime()) : 0;
  const workedMs = Math.max(0, fullDayMs - breakMinutes * 60000 - currentBreakMs);
  const total = useMemo(() => (Number(laborTime || 0) + Number(driveTime || 0)).toFixed(1), [driveTime, laborTime]);

  const handleClockIn = () => { setError(null); startTransition(async () => { const result = await clockInResilientAction(location); if (!result.ok) { setError(result.error); return; } setTimesheetId(result.data.timesheetId); setClockInIso(result.data.clockInAt); setLocation(result.data.location ?? location); setClockedOutAt(""); setNow(Date.now()); }); };
  const handleBreak = () => { if (!timesheetId) return; setError(null); startTransition(async () => { if (breakStartedAt) { const result = await endBreakAction(timesheetId); if (!result.ok) { setError(result.error); return; } setBreakMinutes((m) => m + Math.round((new Date(result.data.endedAt).getTime() - new Date(breakStartedAt).getTime()) / 60000)); setBreakStartedAt(null); } else { const result = await startBreakAction(timesheetId); if (!result.ok) { setError(result.error); return; } setBreakStartedAt(result.data.startedAt); } }); };
  const handleClockOut = () => { if (!timesheetId) { setError("Clock in first."); return; } setError(null); startTransition(async () => { const result = await clockOutResilientAction(timesheetId, Number(laborTime || 0), Number(driveTime || 0)); if (!result.ok) { setError(result.error); return; } setClockedOutAt(result.data.clockOutAt); setTimesheetId(null); setBreakStartedAt(null); }); };

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Full day</p><p className="mt-2 text-2xl font-semibold text-white">{timesheetId ? durationLabel(fullDayMs) : "0h 00m"}</p><p className="mt-1 text-xs text-[#bafcfc]">Clock in → clock out</p></div>
      <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Working time</p><p className="mt-2 text-2xl font-semibold text-white">{timesheetId ? durationLabel(workedMs) : "0h 00m"}</p><p className="mt-1 text-xs text-[#bafcfc]">Breaks excluded</p></div>
      <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Break time</p><p className="mt-2 text-2xl font-semibold text-white">{durationLabel(breakMinutes * 60000 + currentBreakMs)}</p><p className="mt-1 text-xs text-[#bafcfc]">Lunch / personal break</p></div>
    </div>
    <div className="flex flex-wrap gap-2"><StatusPill tone={timesheetId ? "emerald" : "cyan"}>{timesheetId ? `Clocked in ${new Date(clockInIso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : clockedOutAt ? `Clocked out ${new Date(clockedOutAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Not clocked in"}</StatusPill>{breakStartedAt ? <StatusPill tone="amber">On break</StatusPill> : null}</div>
    {error ? <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
    <label className="space-y-2"><span className="inline-flex items-center gap-2 text-sm text-zinc-300"><MapPin className="h-4 w-4 text-[#8ffafa]" />Job site / location</span><input value={location} onChange={(e) => setLocation(e.target.value)} disabled={Boolean(timesheetId)} placeholder="Uses assigned job location if blank" className="w-full rounded-2xl border border-[#2d7dff]/30 bg-black px-4 py-3 text-white disabled:opacity-60" /></label>
    <div className="grid gap-3 sm:grid-cols-3"><button onClick={handleClockIn} disabled={pending || Boolean(timesheetId)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 text-white disabled:opacity-40"><Play className="h-4 w-4" />Clock in</button><button onClick={handleBreak} disabled={pending || !timesheetId} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/30 px-4 py-3 text-amber-100 disabled:opacity-40"><Coffee className="h-4 w-4" />{breakStartedAt ? "End break" : "Start break"}</button><button onClick={handleClockOut} disabled={pending || !timesheetId} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 px-4 py-3 text-white disabled:opacity-40"><Square className="h-4 w-4" />Clock out</button></div>
    <details className="rounded-2xl border border-[#2d7dff]/15 bg-black/30 p-3"><summary className="cursor-pointer text-sm text-[#bafcfc]">Job allocation (optional)</summary><div className="mt-3 grid gap-3 md:grid-cols-2"><label className="space-y-1"><span className="text-xs text-zinc-400">Labor hours</span><input type="number" min="0" step="0.25" value={laborTime} onChange={(e) => setLaborTime(e.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label><label className="space-y-1"><span className="text-xs text-zinc-400">Drive hours</span><input type="number" min="0" step="0.25" value={driveTime} onChange={(e) => setDriveTime(e.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label></div><p className="mt-2 text-xs text-zinc-500">Manual allocation total: {total} hrs</p></details>
  </div>;
}
