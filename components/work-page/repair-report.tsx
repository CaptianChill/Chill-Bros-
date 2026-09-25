"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { registerSaver } from "@/components/work-page/save-registry";
import { REPAIR_OUTCOMES, type RepairOutcome } from "@/lib/chillbros/work-page";
import { saveRepairReportAction } from "@/lib/chillbros/work-page-actions";

type Report = { id: string; outcomeLabel: string; workPerformed: string; finalNotes: string; createdAt: string; technicianName: string };

const field = "mt-1 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] p-3 text-base font-medium leading-6 text-[#0A1A33] placeholder:text-[#5B6B82]";
const when = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Repair / return notes. Saved as a history entry each time, so the
 * diagnosis notes are never overwritten and every visit's report is kept.
 */
export function RepairReportForm({ jobId, reports, canEdit }: { jobId: string; reports: Report[]; canEdit: boolean }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<RepairOutcome>("completed");
  const [workPerformed, setWorkPerformed] = useState("");
  const [finalNotes, setFinalNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current = useRef({ outcome, workPerformed, finalNotes });
  useEffect(() => {
    current.current = { outcome, workPerformed, finalNotes };
  }, [outcome, workPerformed, finalNotes]);

  const persist = useCallback(async () => {
    const { outcome: o, workPerformed: w, finalNotes: f } = current.current;
    if (!w.trim() && !f.trim()) return true;
    const result = await saveRepairReportAction({ jobId, outcome: o, workPerformed: w, finalNotes: f });
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    setWorkPerformed("");
    setFinalNotes("");
    current.current = { outcome: o, workPerformed: "", finalNotes: "" };
    setMessage("Repair report saved.");
    return true;
  }, [jobId]);

  // The sticky SAVE buttons also save a half-written report.
  useEffect(() => (canEdit ? registerSaver(persist) : undefined), [canEdit, persist]);

  return (
    <div className="space-y-3">
      {reports.length ? (
        <ul className="space-y-2">
          {reports.map((report) => (
            <li key={report.id} className="rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] p-2.5 text-sm">
              <p className="font-bold">{report.outcomeLabel}</p>
              {report.workPerformed ? <p className="mt-1 whitespace-pre-wrap font-medium">{report.workPerformed}</p> : null}
              {report.finalNotes ? <p className="mt-1 whitespace-pre-wrap font-medium text-[#2B3F5C]">Final notes: {report.finalNotes}</p> : null}
              <p className="mt-1 text-[12px] font-medium text-[#5B6B82]">{when(report.createdAt)} · {report.technicianName}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {canEdit ? (
        <div className="space-y-2.5">
          <fieldset>
            <legend className="text-sm font-semibold">Outcome</legend>
            <div className="mt-1 grid gap-1.5">
              {Object.entries(REPAIR_OUTCOMES).map(([value, text]) => (
                <label key={value} className={`flex min-h-11 items-center gap-2.5 rounded-xl border px-3 font-semibold ${outcome === value ? "border-[#1557B0] bg-[#DCEBFF]" : "border-[#C7D3E2] bg-white"}`}>
                  <input type="radio" name={`outcome-${jobId}`} value={value} checked={outcome === value} onChange={() => setOutcome(value as RepairOutcome)} className="h-5 w-5" />
                  {text}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold">
            Work performed
            <textarea rows={4} value={workPerformed} maxLength={4000} onChange={(event) => setWorkPerformed(event.target.value)} placeholder="Replaced condenser fan motor, verified amps…" className={field} />
          </label>
          <label className="block text-sm font-semibold">
            Final notes
            <textarea rows={3} value={finalNotes} maxLength={2000} onChange={(event) => setFinalNotes(event.target.value)} placeholder="Recommendations, what's left for the return visit…" className={field} />
          </label>
          <button type="button" disabled={pending} onClick={() => startTransition(async () => { setMessage(null); if (await persist()) router.refresh(); })} className="min-h-12 w-full rounded-xl bg-[#1557B0] font-semibold text-white disabled:opacity-60">
            {pending ? "Saving…" : "Save repair report"}
          </button>
          {error ? <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p> : null}
          {message ? <p role="status" className="text-sm font-semibold text-[#0A7FC2]">{message}</p> : null}
        </div>
      ) : reports.length ? null : (
        <p className="text-sm font-medium text-[#2B3F5C]">No repair report yet.</p>
      )}
    </div>
  );
}
