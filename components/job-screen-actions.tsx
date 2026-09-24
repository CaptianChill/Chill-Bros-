"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { CheckCircle2, Navigation, Save, XCircle } from "lucide-react";

import { closeCallAction, reassignJobTechnicianAction } from "@/lib/chillbros/job-admin-actions";
import { updateTechnicianJobV2Action } from "@/lib/chillbros/job-workflow-v2";
import type { JobStatus } from "@/lib/chillbros/types";

type Result = { ok: boolean; error?: string };

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>, success: string) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          setError(result.error ?? "That didn't save. Try again.");
          return;
        }
        setMessage(success);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That didn't save. Try again.");
      }
    });
  };
  return { pending, error, message, run };
}

function Feedback({ error, message }: { error: string | null; message: string | null }) {
  if (error) return <p role="alert" className="mt-2 text-sm font-semibold text-[#0B5CD5]">{error}</p>;
  if (message) return <p role="status" className="mt-2 text-sm font-semibold text-[#0A7FC2]">{message}</p>;
  return null;
}

type FieldJob = { id: string; workPerformed: string | null; laborHours: number; driveHours: number };

// The one big button for the next field step. Uses the same action as the
// technician screen, passing the saved notes and hours through unchanged.
export function NextStepButton({ job, nextStatus, label }: { job: FieldJob; nextStatus: JobStatus; label: string }) {
  const { pending, error, message, run } = useRun();
  const Icon = nextStatus === "work_complete" ? CheckCircle2 : Navigation;
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(
            () => updateTechnicianJobV2Action({ jobId: job.id, status: nextStatus, workPerformed: job.workPerformed ?? "", laborHours: job.laborHours, driveHours: job.driveHours }),
            `Saved: ${label}.`,
          )
        }
        className="flex h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-[#1557B0] text-lg font-bold text-white shadow-[0_2px_8px_rgba(10,26,51,0.25)] transition hover:bg-[#0E3F82] disabled:opacity-60"
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
        {pending ? "Saving…" : label}
      </button>
      <Feedback error={error} message={message} />
    </div>
  );
}

// Tech notes: saves with the existing field-notes action. Hours are passed
// through as they are so saving notes never resets them.
export function TechNotes({ job, canEdit }: { job: FieldJob; canEdit: boolean }) {
  const id = useId();
  const [notes, setNotes] = useState(job.workPerformed ?? "");
  const { pending, error, message, run } = useRun();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-[#0A1A33]">
        Tech notes
      </label>
      <textarea
        id={id}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        readOnly={!canEdit}
        rows={5}
        placeholder="Diagnosis, readings, repair performed, recommendations…"
        className="mt-1.5 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] p-3 text-base font-medium text-[#0A1A33] placeholder:text-[#5B6B82] read-only:text-[#2B3F5C]"
      />
      {canEdit ? (
        <button
          type="button"
          disabled={pending || notes === (job.workPerformed ?? "")}
          onClick={() => run(() => updateTechnicianJobV2Action({ jobId: job.id, workPerformed: notes, laborHours: job.laborHours, driveHours: job.driveHours }), "Notes saved.")}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#1557B0] bg-[#F8FAFD] px-4 font-semibold text-[#1557B0] disabled:opacity-50"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {pending ? "Saving…" : "Save notes"}
        </button>
      ) : (
        <p className="mt-1.5 text-[13px] text-[#2B3F5C]">The assigned technician writes these notes.</p>
      )}
      <Feedback error={error} message={message} />
    </div>
  );
}

// Technician "Change": only swaps the technician (reassignJobTechnicianAction
// never touches status), so job progress is kept.
export function ChangeTechnician({ jobId, currentTechId, technicians }: { jobId: string; currentTechId: string | null; technicians: { id: string; fullName: string }[] }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [techId, setTechId] = useState(currentTechId ?? "");
  const { pending, error, message, run } = useRun();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-[#1557B0] hover:text-[#0E3F82]">
        Change
      </button>
    );
  }
  return (
    <div className="mt-2 w-full">
      <label htmlFor={id} className="sr-only">
        Technician
      </label>
      <div className="flex gap-2">
        <select id={id} value={techId} onChange={(event) => setTechId(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 text-sm font-medium text-[#0A1A33]">
          <option value="">Unassigned</option>
          {technicians.map((tech) => (
            <option key={tech.id} value={tech.id}>
              {tech.fullName}
            </option>
          ))}
        </select>
        <button type="button" disabled={pending} onClick={() => run(() => reassignJobTechnicianAction(jobId, techId), "Technician updated.")} className="min-h-11 shrink-0 rounded-xl bg-[#1557B0] px-4 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <Feedback error={error} message={message} />
    </div>
  );
}

// Close call works from any active status (closeCallAction checks that).
export function CloseCallButton({ jobId }: { jobId: string }) {
  const [confirming, setConfirming] = useState(false);
  const { pending, error, message, run } = useRun();
  return (
    <div>
      {confirming ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={pending} onClick={() => run(() => closeCallAction(jobId), "Call closed.")} className="min-h-12 rounded-xl bg-[#0B5CD5] px-3 font-semibold text-white disabled:opacity-60">
            {pending ? "Closing…" : "Yes, close call"}
          </button>
          <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="min-h-12 rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 font-semibold text-[#0A1A33]">
            Keep open
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#1557B0] bg-[#F8FAFD] px-3 font-semibold text-[#1557B0]">
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Close call
        </button>
      )}
      <Feedback error={error} message={message} />
    </div>
  );
}
