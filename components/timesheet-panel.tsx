"use client";

import { useMemo, useState, useTransition } from "react";
import { Clock3, MapPin } from "lucide-react";

import { clockInAction, clockOutAction } from "@/lib/chillbros/mutations";
import { StatusPill } from "@/components/status-pill";

export function TimesheetPanel() {
  const [timesheetId, setTimesheetId] = useState<string | null>(null);
  const [clockedInAt, setClockedInAt] = useState("");
  const [clockedOutAt, setClockedOutAt] = useState("");
  const [location, setLocation] = useState("");
  const [laborTime, setLaborTime] = useState("0");
  const [driveTime, setDriveTime] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = useMemo(() => (Number(laborTime || 0) + Number(driveTime || 0)).toFixed(1), [driveTime, laborTime]);

  const handleClockIn = () => {
    setError(null);
    startTransition(async () => {
      const result = await clockInAction(location);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTimesheetId(result.data.timesheetId);
      setClockedInAt(new Date(result.data.clockInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setClockedOutAt("");
    });
  };

  const handleClockOut = () => {
    if (!timesheetId) {
      setError("Clock in first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await clockOutAction(timesheetId, Number(laborTime || 0), Number(driveTime || 0));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setClockedOutAt(new Date(result.data.clockOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <StatusPill tone={clockedInAt ? "emerald" : "cyan"}>{clockedInAt ? `Clocked in ${clockedInAt}` : "Not clocked in"}</StatusPill>
        <StatusPill tone={clockedOutAt ? "cyan" : "amber"}>{clockedOutAt ? `Clocked out ${clockedOutAt}` : "Clock-out pending"}</StatusPill>
      </div>

      {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="inline-flex items-center gap-2 text-sm text-zinc-300">
            <MapPin className="h-4 w-4 text-[#8ffafa]" />
            Job site / location tag
          </span>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Customer name / address"
            className="w-full rounded-2xl border border-[#00f0f0]/30 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
          />
        </label>
        <div className="rounded-2xl border border-[#00f0f0]/20 bg-black/40 p-4">
          <p className="text-sm text-zinc-400">Daily total</p>
          <p className="mt-2 text-3xl font-semibold text-white">{total} hrs</p>
          <p className="mt-2 text-sm text-[#bafcfc]">Labor + drive time saved per technician session.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">Labor time</span>
          <input
            value={laborTime}
            onChange={(event) => setLaborTime(event.target.value)}
            className="w-full rounded-2xl border border-[#00f0f0]/30 bg-black px-4 py-3 text-sm text-white outline-none"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">Drive time</span>
          <input
            value={driveTime}
            onChange={(event) => setDriveTime(event.target.value)}
            className="w-full rounded-2xl border border-[#00f0f0]/30 bg-black px-4 py-3 text-sm text-white outline-none"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleClockIn}
          disabled={pending || Boolean(clockedInAt && !clockedOutAt)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#61f7f7] bg-[#00f0f0]/10 px-4 py-3 font-medium text-[#defefe] transition hover:bg-[#00f0f0]/20 disabled:opacity-60"
        >
          <Clock3 className="h-4 w-4" />
          Clock in
        </button>
        <button
          type="button"
          onClick={handleClockOut}
          disabled={pending || !timesheetId || Boolean(clockedOutAt)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#00f0f0]/30 px-4 py-3 text-white transition hover:bg-[#00f0f0]/10 disabled:opacity-60"
        >
          <Clock3 className="h-4 w-4" />
          Clock out
        </button>
      </div>
    </div>
  );
}
