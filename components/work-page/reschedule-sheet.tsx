"use client";

import { useEffect, useId, useRef } from "react";
import { CalendarClock, X } from "lucide-react";

import { rescheduleOwnJobAction } from "@/app/schedule/actions";
import { SubmitButton } from "@/components/work-page/submit-button";
import { RESCHEDULE_REASONS, type RescheduleReason } from "@/lib/chillbros/work-page";

const SHEET_ID = "work-page-reschedule";
const TIMES = Array.from({ length: 31 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const field = "mt-1 min-h-12 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 text-base font-medium text-[#0A1A33]";

function label(time: string) {
  const [h, m] = time.split(":").map(Number);
  return new Date(Date.UTC(2026, 0, 1, h, m)).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" });
}

/** Opens the reschedule sheet, optionally with a reason already picked. */
export function openRescheduleSheet(reason?: RescheduleReason) {
  const dialog = document.getElementById(SHEET_ID) as HTMLDialogElement | null;
  if (!dialog) return;
  const select = dialog.querySelector<HTMLSelectElement>("select[name=reason]");
  if (select && reason) select.value = reason;
  dialog.showModal();
}

export function RescheduleButton({ reason, className, children }: { reason?: RescheduleReason; className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={() => openRescheduleSheet(reason)} className={className ?? "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#1557B0] bg-white px-3 text-sm font-semibold text-[#1557B0]"}>
      {children ?? (
        <>
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          Reschedule
        </>
      )}
    </button>
  );
}

/**
 * The assigned technician moves their own call. Same job, same notes/photos/
 * parts; rescheduleOwnJobAction validates, checks conflicts and logs history.
 */
export function RescheduleSheet({ jobId, defaultDate, defaultStart, defaultEnd, openOnLoad }: { jobId: string; defaultDate: string; defaultStart: string; defaultEnd: string; openOnLoad?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (openOnLoad && ref.current && !ref.current.open) ref.current.showModal();
  }, [openOnLoad]);

  return (
    <dialog
      ref={ref}
      id={SHEET_ID}
      aria-labelledby={titleId}
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl bg-white p-0 text-[#0A1A33] backdrop:bg-[#0A1A33]/60 sm:m-auto sm:max-w-md sm:rounded-2xl"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <form data-no-draft action={rescheduleOwnJobAction} className="max-h-[85dvh] space-y-3 overflow-y-auto p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-xl font-bold">Reschedule this call</h2>
          <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#2B3F5C]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="text-sm font-medium text-[#2B3F5C]">Same job — your notes, photos and parts stay on it. The office sees who moved it and why.</p>
        <input type="hidden" name="jobId" value={jobId} />
        <label className="block text-sm font-semibold">
          Why?
          <select name="reason" required defaultValue="customer_not_ready" className={field}>
            {Object.entries(RESCHEDULE_REASONS).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Note <span className="font-medium text-[#2B3F5C]">(required for &ldquo;Other&rdquo;)</span>
          <input name="note" maxLength={300} placeholder="e.g. Tenant not home, gate code wrong" className={field} />
        </label>
        <label className="block text-sm font-semibold">
          New date
          <input required type="date" name="date" defaultValue={defaultDate} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-semibold">
            Start
            <select name="start" defaultValue={defaultStart} className={field}>
              {TIMES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            End
            <select name="end" defaultValue={defaultEnd} className={field}>
              {TIMES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
            </select>
          </label>
        </div>
        <SubmitButton pendingText="Saving…" className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1557B0] text-base font-bold text-white disabled:opacity-60">
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
          Save new time
        </SubmitButton>
      </form>
    </dialog>
  );
}
