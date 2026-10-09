"use client";

import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateJobTimeAction } from "@/lib/chillbros/job-time-actions";

const field = "mt-1 min-h-11 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 font-medium text-[#0A1A33]";

export function JobTimeCard({ jobId, laborHours, driveHours, canEdit }: { jobId: string; laborHours: number; driveHours: number; canEdit: boolean }) {
  const router = useRouter();
  const [labor, setLabor] = useState(String(laborHours ?? 0));
  const [drive, setDrive] = useState(String(driveHours ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null); setMessage(null);
    start(async () => {
      const result = await updateJobTimeAction(jobId, Number(labor), Number(drive));
      if (!result.ok) { setError(result.error); return; }
      setMessage("Time saved.");
      router.refresh();
    });
  };

  return <div>
    <div className="grid grid-cols-2 gap-2">
      <label className="text-[13px] font-semibold text-[#0A1A33]">Labor hours<input type="number" inputMode="decimal" min="0" max="24" step="0.25" value={labor} onChange={(e) => setLabor(e.target.value)} readOnly={!canEdit} className={field} /></label>
      <label className="text-[13px] font-semibold text-[#0A1A33]">Drive hours<input type="number" inputMode="decimal" min="0" max="24" step="0.25" value={drive} onChange={(e) => setDrive(e.target.value)} readOnly={!canEdit} className={field} /></label>
    </div>
    {canEdit ? <button type="button" onClick={save} disabled={pending} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#1B3FD0] bg-[#F8FAFD] px-4 font-semibold text-[#1B3FD0] disabled:opacity-50"><Clock className="h-4 w-4" aria-hidden="true" />{pending ? "Saving…" : "Save time"}</button> : null}
    {error ? <p role="alert" className="mt-2 text-sm font-semibold text-[#B42318]">{error}</p> : null}
    {message ? <p role="status" className="mt-2 text-sm font-semibold text-[#0A7FC2]">{message}</p> : null}
  </div>;
}
