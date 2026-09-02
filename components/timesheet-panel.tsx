"use client";

import { useMemo, useState } from "react";
import { Clock3, MapPin } from "lucide-react";

import { StatusPill } from "@/components/status-pill";

export function TimesheetPanel() {
  const [clockedInAt, setClockedInAt] = useState("07:12 AM");
  const [clockedOutAt, setClockedOutAt] = useState("");
  const [location, setLocation] = useState("Jordan Smith • 1440 Falcon Ridge, Austin, TX");
  const [laborTime, setLaborTime] = useState("1.5");
  const [driveTime, setDriveTime] = useState("0.6");

  const total = useMemo(() => (Number(laborTime || 0) + Number(driveTime || 0)).toFixed(1), [driveTime, laborTime]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <StatusPill tone="emerald">Clocked in {clockedInAt}</StatusPill>
        <StatusPill tone={clockedOutAt ? "cyan" : "amber"}>{clockedOutAt ? `Clocked out ${clockedOutAt}` : "Clock-out pending"}</StatusPill>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="inline-flex items-center gap-2 text-sm text-zinc-300">
            <MapPin className="h-4 w-4 text-cyan-300" />
            Job site / location tag
          </span>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="w-full rounded-2xl border border-cyan-400/30 bg-black px-4 py-3 text-sm text-white outline-none"
          />
        </label>
        <div className="rounded-2xl border border-cyan-400/20 bg-black/40 p-4">
          <p className="text-sm text-zinc-400">Daily total</p>
          <p className="mt-2 text-3xl font-semibold text-white">{total} hrs</p>
          <p className="mt-2 text-sm text-cyan-200">Labor + drive time saved per technician session.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">Labor time</span>
          <input
            value={laborTime}
            onChange={(event) => setLaborTime(event.target.value)}
            className="w-full rounded-2xl border border-cyan-400/30 bg-black px-4 py-3 text-sm text-white outline-none"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">Drive time</span>
          <input
            value={driveTime}
            onChange={(event) => setDriveTime(event.target.value)}
            className="w-full rounded-2xl border border-cyan-400/30 bg-black px-4 py-3 text-sm text-white outline-none"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setClockedInAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300 bg-cyan-400/10 px-4 py-3 font-medium text-cyan-100 transition hover:bg-cyan-400/20"
        >
          <Clock3 className="h-4 w-4" />
          Clock in
        </button>
        <button
          type="button"
          onClick={() => setClockedOutAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 px-4 py-3 text-white transition hover:bg-cyan-400/10"
        >
          <Clock3 className="h-4 w-4" />
          Clock out
        </button>
      </div>
    </div>
  );
}
