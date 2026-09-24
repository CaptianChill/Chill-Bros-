"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Link2 } from "lucide-react";

import { linkEquipmentToJobAction } from "@/lib/chillbros/job-asset-actions";

// Attach one of this customer's past or current jobs to the unit, using the
// existing link-equipment action, so it shows in the unit's service history.
export function LinkJobToUnit({ equipmentId, jobs }: { equipmentId: string; jobs: { id: string; label: string }[] }) {
  const router = useRouter();
  const id = useId();
  const [jobId, setJobId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (jobs.length === 0) return <p className="text-sm font-medium text-[#2B3F5C]">This customer has no other jobs to link.</p>;

  const link = () => {
    if (!jobId) {
      setError("Choose a job first.");
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await linkEquipmentToJobAction({ jobId, equipmentId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Job linked. It now shows in this unit's history.");
      setJobId("");
      router.refresh();
    });
  };

  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-[#0A1A33]">
        Link a past job to this unit
      </label>
      <div className="mt-1.5 flex gap-2">
        <select id={id} value={jobId} onChange={(event) => setJobId(event.target.value)} disabled={pending} className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 text-sm font-medium text-[#0A1A33]">
          <option value="">Choose a job</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={link} disabled={pending} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#1557B0] px-4 text-sm font-semibold text-white disabled:opacity-60">
          <Link2 className="h-4 w-4" aria-hidden="true" />
          {pending ? "Linking…" : "Link"}
        </button>
      </div>
      {error ? <p role="alert" className="mt-1.5 text-sm font-semibold text-[#0B5CD5]">{error}</p> : null}
      {message ? <p role="status" className="mt-1.5 text-sm font-semibold text-[#0A7FC2]">{message}</p> : null}
    </div>
  );
}
