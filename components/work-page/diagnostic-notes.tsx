"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, CheckCircle2, RotateCcw } from "lucide-react";

import { VoiceDictationButton } from "@/components/voice-dictation-button";
import { registerSaver } from "@/components/work-page/save-registry";
import { updateTechnicianJobV2Action } from "@/lib/chillbros/job-workflow-v2";

const AUTOSAVE_MS = 2500;
const MAX = 6000;
type Draft = { text: string; base: string; at: number };

function readDraft(key: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string, draft: Draft | null) {
  try {
    if (draft) window.localStorage.setItem(key, JSON.stringify(draft));
    else window.localStorage.removeItem(key);
  } catch {
    // Private mode / storage full: the server autosave still runs.
  }
}
const clock = () => new Date().toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });

/**
 * Diagnosis notes (chillbros_jobs.work_performed). Autosaves a few seconds
 * after typing stops, when the app is backgrounded, and when a sticky SAVE
 * button is pressed. Every keystroke is also kept on this phone until the
 * server confirms, so a dropped signal or closed tab never loses notes.
 * Each save writes a workflow event with the technician's name and time.
 */
export function DiagnosticNotes({ jobId, initialNotes, canEdit, lastSavedLabel }: { jobId: string; initialNotes: string; canEdit: boolean; lastSavedLabel: string | null }) {
  const id = useId();
  const draftKey = `chillbros-work-notes-${jobId}`;
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState<string | null>(lastSavedLabel);
  const [error, setError] = useState<string | null>(null);
  const [staleDraft, setStaleDraft] = useState<Draft | null>(null);
  const saved = useRef(initialNotes);
  const latest = useRef(initialNotes);
  const timer = useRef<number | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);

  const save = useCallback(async (): Promise<boolean> => {
    if (!canEdit) return true;
    if (timer.current) window.clearTimeout(timer.current);
    if (inflight.current) await inflight.current;
    const text = latest.current;
    if (text === saved.current) return true;
    setStatus("Saving…");
    const run = updateTechnicianJobV2Action({ jobId, workPerformed: text })
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          setStatus("Not saved — kept on this phone");
          return false;
        }
        saved.current = text;
        setError(null);
        setStatus(`Saved ${clock()}`);
        if (latest.current === text) writeDraft(draftKey, null);
        return true;
      })
      .catch(() => {
        setStatus("Offline — kept on this phone");
        return false;
      })
      .finally(() => {
        inflight.current = null;
      });
    inflight.current = run;
    return run;
  }, [canEdit, draftKey, jobId]);

  // Restore an unsent draft from this phone.
  useEffect(() => {
    if (!canEdit) return;
    const draft = readDraft(draftKey);
    if (!draft || draft.text === initialNotes) return;
    if (draft.base === initialNotes) {
      // Nothing changed on the server since: pick up where the tech left off.
      queueMicrotask(() => {
        latest.current = draft.text;
        setNotes(draft.text);
        setStatus("Restored unsaved notes from this phone");
        void save();
      });
    } else {
      queueMicrotask(() => setStaleDraft(draft));
    }
    // Only on first load for this job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!canEdit) return;
    const unregister = registerSaver(save);
    const onHide = () => {
      if (document.visibilityState === "hidden") void save();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      unregister();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [canEdit, save]);

  const change = (next: string) => {
    const text = next.slice(0, MAX);
    latest.current = text;
    setNotes(text);
    setStatus("Unsaved changes");
    writeDraft(draftKey, { text, base: saved.current, at: Date.now() });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), AUTOSAVE_MS);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-lg font-bold">Diagnosis notes</label>
        {status ? (
          <span role="status" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2B3F5C]">
            {status.startsWith("Saved") ? <CheckCircle2 className="h-4 w-4 text-[#0A7FC2]" aria-hidden="true" /> : null}
            {status}
          </span>
        ) : null}
      </div>
      {staleDraft ? (
        <div className="mt-2 rounded-xl border border-[#E0A100] bg-[#FFF7E0] p-2.5 text-sm font-medium">
          <p>Unsaved notes from this phone are different from what&apos;s saved now.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => { change(staleDraft.text); setStaleDraft(null); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#1557B0] px-3 font-semibold text-white">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Use phone notes
            </button>
            <button type="button" onClick={() => { writeDraft(draftKey, null); setStaleDraft(null); }} className="min-h-11 rounded-lg border border-[#C7D3E2] px-3 font-semibold">
              Keep saved
            </button>
          </div>
        </div>
      ) : null}
      <textarea
        id={id}
        value={notes}
        onChange={(event) => change(event.target.value)}
        onBlur={() => void save()}
        readOnly={!canEdit}
        rows={7}
        maxLength={MAX}
        placeholder="What you found: symptoms, readings, cause, what it needs…"
        className="mt-1.5 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] p-3 text-base font-medium leading-6 text-[#0A1A33] placeholder:text-[#5B6B82] read-only:text-[#2B3F5C]"
      />
      {canEdit ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <VoiceDictationButton getValue={() => latest.current} setValue={change} />
          <button type="button" onClick={() => document.getElementById("before-photos-input")?.click()} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#1557B0] bg-white px-3 text-sm font-semibold text-[#1557B0]">
            <Camera className="h-4 w-4" aria-hidden="true" />
            Add photo
          </button>
        </div>
      ) : (
        <p className="mt-1.5 text-[13px] font-medium text-[#2B3F5C]">The assigned technician writes these notes.</p>
      )}
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-[#B42318]">{error}</p> : null}
    </div>
  );
}
