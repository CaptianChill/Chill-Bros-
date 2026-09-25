"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { CalendarClock, ChevronLeft, Ellipsis } from "lucide-react";

import { openRescheduleSheet } from "@/components/work-page/reschedule-sheet";
import { flushAllSavers } from "@/components/work-page/save-registry";
import { updateTechnicianJobV2Action } from "@/lib/chillbros/job-workflow-v2";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/chillbros/types";

export type WorkMenuLink = { href: string; label: string; external?: boolean };

/**
 * Sticky Work Page header: back, who/where, a status dropdown that only offers
 * the valid next field statuses, and a ⋯ menu for everything one tap away.
 */
export function WorkHeader({ jobId, backHref, customer, location, status, nextStatuses, canReschedule, links }: { jobId: string; backHref: string; customer: string; location: string | null; status: JobStatus; nextStatuses: JobStatus[]; canReschedule: boolean; links: WorkMenuLink[] }) {
  const router = useRouter();
  const statusId = useId();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Close the ⋯ menu when tapping anywhere else.
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menuRef.current?.open && !menuRef.current.contains(event.target as Node)) menuRef.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const change = (next: JobStatus) => {
    if (next === status) return;
    setError(null);
    startTransition(async () => {
      if (!(await flushAllSavers())) return setError("Notes didn't save yet, so the status wasn't changed.");
      const result = await updateTechnicianJobV2Action({ jobId, status: next });
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  return (
    <div className="cb-work-sticky sticky top-0 z-40 -mx-4 mb-3.5 px-3 py-2 lg:mx-0 lg:rounded-2xl">
      <div className="flex items-center gap-2">
        <Link href={backHref} aria-label="Back" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight text-white">{customer}</p>
          <p className="truncate text-[13px] font-medium text-[#C9DCF5]">{location || "No address saved"}</p>
        </div>
        <details ref={menuRef} className="relative shrink-0">
          <summary aria-label="More actions" className="inline-flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full bg-white/10 text-white [&::-webkit-details-marker]:hidden">
            <Ellipsis className="h-6 w-6" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-xl border border-[#C7D3E2] bg-white py-1 text-[#0A1A33] shadow-xl">
            {canReschedule ? (
              <button type="button" onClick={() => { if (menuRef.current) menuRef.current.open = false; openRescheduleSheet(); }} className="flex min-h-12 w-full items-center gap-2 px-4 text-left font-semibold hover:bg-[#F0F5FC]">
                <CalendarClock className="h-4 w-4 text-[#1557B0]" aria-hidden="true" />
                Reschedule
              </button>
            ) : null}
            {links.map((link) =>
              link.external ? (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="flex min-h-12 items-center px-4 font-semibold hover:bg-[#F0F5FC]">{link.label}</a>
              ) : (
                <Link key={link.href} href={link.href} className="flex min-h-12 items-center px-4 font-semibold hover:bg-[#F0F5FC]">{link.label}</Link>
              ),
            )}
          </div>
        </details>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <label htmlFor={statusId} className="shrink-0 text-[12px] font-bold uppercase tracking-wide text-[#C9DCF5]">Status</label>
        {nextStatuses.length ? (
          <select id={statusId} value={status} disabled={pending} onChange={(event) => change(event.target.value as JobStatus)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/30 bg-white px-2 text-base font-bold text-[#0A1A33] disabled:opacity-60">
            <option value={status}>{JOB_STATUS_LABELS[status]}</option>
            {nextStatuses.map((next) => (
              <option key={next} value={next}>→ {JOB_STATUS_LABELS[next]}</option>
            ))}
          </select>
        ) : (
          <span id={statusId} className="rounded-lg bg-white px-2.5 py-1.5 text-sm font-bold text-[#0A1A33]">{JOB_STATUS_LABELS[status]}</span>
        )}
      </div>
      {error ? <p role="alert" className="mt-1 rounded bg-[#FDECEA] px-2 py-1 text-sm font-semibold text-[#B42318]">{error}</p> : null}
    </div>
  );
}
