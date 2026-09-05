"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Save, UserRoundCheck, Wrench } from "lucide-react";

import { managerClockOutNowAction, managerCreateTimesheetAction, managerUpdateTimesheetAction } from "@/lib/chillbros/timesheet-operations";
import type { StaffCallRow, TimekeepingStaff, TimesheetHistoryRow } from "@/lib/chillbros/operations-queries";
import { StatusPill } from "@/components/status-pill";

function localInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function iso(value: string) { return value ? new Date(value).toISOString() : null; }
function central(value: string | null) { return value ? new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "Open"; }

export function ManagerTimesheetAdmin({ rows, staff, calls }: { rows: TimesheetHistoryRow[]; staff: TimekeepingStaff[]; calls: StaffCallRow[] }) {
  const router = useRouter();
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [techId, setTechId] = useState(staff[0]?.id ?? "");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [location, setLocation] = useState("");
  const [labor, setLabor] = useState("0");
  const [drive, setDrive] = useState("0");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const filteredRows = useMemo(() => selectedStaff === "all" ? rows : rows.filter((row) => row.technicianId === selectedStaff), [rows, selectedStaff]);
  const filteredCalls = useMemo(() => selectedStaff === "all" ? calls : calls.filter((call) => call.technicianId === selectedStaff), [calls, selectedStaff]);

  const create = () => startTransition(async () => {
    setMessage(null);
    if (!techId || !clockIn) { setMessage("Choose an employee and clock-in time."); return; }
    const result = await managerCreateTimesheetAction({ technicianId: techId, clockInAt: iso(clockIn)!, clockOutAt: iso(clockOut), location, laborHours: Number(labor || 0), driveHours: Number(drive || 0) });
    if (!result.ok) { setMessage(result.error); return; }
    setMessage("Time entry saved."); setClockIn(""); setClockOut(""); setLocation(""); setLabor("0"); setDrive("0"); router.refresh();
  });

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#2d7dff]/20 bg-black/35 p-3">
      <div className="flex items-center gap-2"><UserRoundCheck className="h-4 w-4 text-[#8ffafa]" /><span className="text-sm font-medium text-white">Employee view</span></div>
      <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className="min-w-48 rounded-xl border border-[#2d7dff]/25 bg-black px-3 py-2 text-sm text-white">
        <option value="all">All employees</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.fullName} · {person.role}</option>)}
      </select>
    </div>

    <details className="rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-3">
      <summary className="cursor-pointer list-none text-sm font-medium text-[#d9fbff]">Add or restore a time entry</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1"><span className="text-xs text-zinc-400">Employee</span><select value={techId} onChange={(e) => setTechId(e.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2.5 text-white">{staff.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs text-zinc-400">Clock in</span><input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label>
        <label className="space-y-1"><span className="text-xs text-zinc-400">Clock out (leave blank if still working)</span><input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label>
        <label className="space-y-1"><span className="text-xs text-zinc-400">Location</span><input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label>
        <label className="space-y-1"><span className="text-xs text-zinc-400">Labor hours</span><input type="number" min="0" max="24" step="0.01" value={labor} onChange={(e) => setLabor(e.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label>
        <label className="space-y-1"><span className="text-xs text-zinc-400">Drive hours</span><input type="number" min="0" max="24" step="0.01" value={drive} onChange={(e) => setDrive(e.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label>
      </div>
      <button type="button" onClick={create} disabled={pending || !staff.length} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#8ffafa]/35 bg-[#2d7dff]/10 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"><Save className="h-4 w-4" />Save time entry</button>
      {message ? <p className="mt-2 text-xs text-[#bafcfc]">{message}</p> : null}
    </details>

    <div className="space-y-2">
      {filteredRows.length === 0 ? <p className="text-sm text-zinc-500">No time entries for this employee.</p> : filteredRows.map((row) => <TimeRow key={row.id} row={row} />)}
    </div>

    <div className="pt-2">
      <div className="mb-2 flex items-center gap-2"><Wrench className="h-4 w-4 text-[#8ffafa]" /><h3 className="text-base font-semibold text-white">Calls & saved technician notes</h3></div>
      <div className="space-y-2">{filteredCalls.length === 0 ? <p className="text-sm text-zinc-500">No service calls for this employee.</p> : filteredCalls.map((call) => <details key={call.id} className="rounded-xl border border-[#2d7dff]/15 bg-black/35 p-3"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{call.customerName}</p><p className="mt-1 text-xs text-zinc-500">{call.technicianName} · {call.scheduledWindow ?? central(call.createdAt)}</p></div><StatusPill tone={call.status === "completed" ? "emerald" : call.status === "cancelled" ? "rose" : "amber"}>{call.status.replace(/_/g, " ")}</StatusPill></summary><div className="mt-3 space-y-2 border-t border-[#2d7dff]/10 pt-3 text-sm text-zinc-300">{call.location ? <p><span className="text-zinc-500">Location:</span> {call.location}</p> : null}{call.scope ? <p className="whitespace-pre-wrap"><span className="text-zinc-500">Scope:</span> {call.scope}</p> : null}{call.workPerformed ? <p className="whitespace-pre-wrap"><span className="text-zinc-500">Tech notes:</span> {call.workPerformed}</p> : <p className="text-zinc-500">No technician notes saved on this call.</p>}<p className="text-xs text-[#bafcfc]">Labor {call.laborHours.toFixed(2)} hr · Drive {call.driveHours.toFixed(2)} hr</p></div></details>)}</div>
    </div>
  </div>;
}

function TimeRow({ row }: { row: TimesheetHistoryRow }) {
  const router = useRouter();
  const [clockIn, setClockIn] = useState(localInput(row.clockInAt));
  const [clockOut, setClockOut] = useState(localInput(row.clockOutAt));
  const [location, setLocation] = useState(row.location ?? "");
  const [labor, setLabor] = useState(String(row.laborHours));
  const [drive, setDrive] = useState(String(row.driveHours));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const save = () => startTransition(async () => {
    setMessage(null);
    const result = await managerUpdateTimesheetAction({ timesheetId: row.id, technicianId: row.technicianId, clockInAt: iso(clockIn)!, clockOutAt: iso(clockOut), location, laborHours: Number(labor || 0), driveHours: Number(drive || 0) });
    if (!result.ok) { setMessage(result.error); return; }
    setMessage("Saved."); router.refresh();
  });
  const closeNow = () => startTransition(async () => {
    const result = await managerClockOutNowAction(row.id);
    if (!result.ok) { setMessage(result.error); return; }
    setClockOut(localInput(result.data.clockOutAt)); setLabor(String(result.data.laborHours)); setMessage("Clocked out and hours calculated."); router.refresh();
  });
  return <details className="rounded-xl border border-[#2d7dff]/15 bg-black/35 p-3" open={!row.clockOutAt}>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{row.technicianName}</p><p className="mt-1 text-xs text-zinc-500">{central(row.clockInAt)} → {central(row.clockOutAt)}</p></div><StatusPill tone={row.clockOutAt ? "cyan" : "emerald"}>{row.clockOutAt ? `${(row.laborHours + row.driveHours).toFixed(2)} hr` : "Clocked in"}</StatusPill></summary>
    <div className="mt-3 grid gap-2 border-t border-[#2d7dff]/10 pt-3 md:grid-cols-2 xl:grid-cols-5"><input aria-label="Clock in" type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" /><input aria-label="Clock out" type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" /><input aria-label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" /><input aria-label="Labor hours" type="number" min="0" max="24" step="0.01" value={labor} onChange={(e) => setLabor(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" /><input aria-label="Drive hours" type="number" min="0" max="24" step="0.01" value={drive} onChange={(e) => setDrive(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" /></div>
    <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={save} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d7dff]/30 px-3 py-2 text-xs text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" />Save correction</button>{!row.clockOutAt ? <button type="button" onClick={closeNow} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 disabled:opacity-50"><Clock3 className="h-3.5 w-3.5" />Clock out now</button> : null}</div>{message ? <p className="mt-2 text-xs text-[#bafcfc]">{message}</p> : null}
  </details>;
}
