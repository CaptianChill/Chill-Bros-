"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { reassignJobTechnicianAction } from "@/lib/chillbros/job-admin-actions";

// Assigning only sets the technician (reassignJobTechnicianAction never
// touches the job's status), so job progress is never reset here.
export function DispatchAssignRow({ jobId, customerName, technicians }: { jobId: string; customerName: string; technicians: { id: string; fullName: string }[] }) {
  const router = useRouter();
  const selectId = useId();
  const [techId, setTechId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const assign = () => {
    if (!techId) {
      setError("Choose a technician first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await reassignJobTechnicianAction(jobId, techId);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  };

  return (
    <div className="mt-2.5">
      <div className="flex gap-2">
        <label htmlFor={selectId} className="sr-only">
          Technician for {customerName}
        </label>
        <select
          id={selectId}
          value={techId}
          onChange={(event) => setTechId(event.target.value)}
          disabled={pending}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#C7D3E2] bg-white px-3 text-sm text-[#0A1A33] disabled:opacity-60"
        >
          <option value="">Choose technician</option>
          {technicians.map((tech) => (
            <option key={tech.id} value={tech.id}>
              {tech.fullName}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={assign}
          disabled={pending}
          className="min-h-11 shrink-0 rounded-xl bg-[#1557B0] px-5 text-sm font-semibold text-white transition hover:bg-[#0E3F82] disabled:opacity-60"
        >
          {pending ? "Assigning…" : "Assign"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-[13px] font-medium text-[#0B5CD5]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
