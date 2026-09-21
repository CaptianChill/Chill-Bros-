"use client";

import { useState, useTransition } from "react";

import { reassignJobTechnicianAction } from "@/lib/chillbros/job-admin-actions";

export function JobDispatchControl({ jobId, currentTechId, technicians }: { jobId: string; currentTechId: string | null; technicians: { id: string; fullName: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
      <label className="text-xs text-zinc-500">Dispatch:</label>
      <select
        defaultValue={currentTechId ?? ""}
        disabled={pending}
        onChange={(event) => {
          setError(null);
          const technicianId = event.target.value;
          startTransition(async () => {
            const result = await reassignJobTechnicianAction(jobId, technicianId);
            if (!result.ok) setError(result.error);
          });
        }}
        className="rounded-lg border border-[#2d7dff]/25 bg-black px-2 py-1.5 text-xs text-white disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}</option>)}
      </select>
      {pending ? <span className="text-xs text-zinc-500">Dispatching…</span> : null}
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
    </div>
  );
}
