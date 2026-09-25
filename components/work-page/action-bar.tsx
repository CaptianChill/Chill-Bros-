"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { openRescheduleSheet } from "@/components/work-page/reschedule-sheet";
import { flushAllSavers } from "@/components/work-page/save-registry";
import { SubmitButton } from "@/components/work-page/submit-button";
import { issueInvoiceForCompletedWorkAction } from "@/lib/chillbros/job-lifecycle-actions";
import { updateTechnicianJobV2Action } from "@/lib/chillbros/job-workflow-v2";
import type { JobStatus } from "@/lib/chillbros/types";
import type { ActionBarMode } from "@/lib/chillbros/work-page";

type InvoiceSummary = { id: string; status: string; portalToken: string; issued: boolean };

const base = "flex min-h-[52px] min-w-0 flex-1 items-center justify-center rounded-xl px-2 text-center text-[13px] font-extrabold uppercase leading-tight tracking-wide transition disabled:opacity-60 sm:text-sm";
const secondary = `${base} border-2 border-white/70 bg-transparent text-white`;
const primary = `${base} bg-[#9FD3FF] text-[#0A1A33]`;
const middle = `${base} bg-[#1557B0] text-white`;

/** Hide the bar while the on-screen keyboard is up so it never covers an input. */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const isField = (node: EventTarget | null) =>
      node instanceof HTMLElement && (node.tagName === "TEXTAREA" || node.tagName === "SELECT" || (node.tagName === "INPUT" && !["checkbox", "radio", "button", "submit", "file"].includes((node as HTMLInputElement).type)));
    const onIn = (event: FocusEvent) => setOpen(isField(event.target));
    const onOut = () => window.setTimeout(() => setOpen(isField(document.activeElement)), 50);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return open;
}

export function WorkActionBar({ jobId, status, mode, invoice, quoteHref, canSendInvoice }: { jobId: string; status: JobStatus; mode: ActionBarMode; invoice: InvoiceSummary | null; quoteHref: string; canSendInvoice: boolean }) {
  const router = useRouter();
  const keyboardOpen = useKeyboardOpen();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (mode === "closed") return null;

  const save = (exit: boolean) =>
    startTransition(async () => {
      setMessage(null);
      const ok = await flushAllSavers();
      if (!ok) return setMessage({ tone: "error", text: "Something didn't save. Check the red message above and try again." });
      if (exit) router.push(`/technician?saved=${encodeURIComponent(jobId)}`);
      else {
        setMessage({ tone: "ok", text: "Saved." });
        router.refresh();
      }
    });

  const moveTo = (status: JobStatus, done: string, exitAfter = false) =>
    startTransition(async () => {
      setMessage(null);
      if (!(await flushAllSavers())) return setMessage({ tone: "error", text: "Notes didn't save yet, so the status wasn't changed. Try again." });
      const result = await updateTechnicianJobV2Action({ jobId, status });
      if (!result.ok) return setMessage({ tone: "error", text: result.error });
      if (exitAfter) router.push(`/technician?submitted=${encodeURIComponent(jobId)}`);
      else {
        setMessage({ tone: "ok", text: done });
        router.refresh();
      }
    });

  const goQuote = () =>
    startTransition(async () => {
      await flushAllSavers();
      router.push(quoteHref);
    });

  let buttons: React.ReactNode;
  switch (mode) {
    case "travel":
      buttons = (
        <>
          <button type="button" className={secondary} disabled={pending} onClick={() => save(true)}>Save &amp; exit</button>
          {/* Owner's transitions: Scheduled → On my way → Arrived. */}
          {status === "en_route" ? (
            <button type="button" className={primary} disabled={pending} onClick={() => moveTo("arrived", "Arrived.")}>Arrived</button>
          ) : (
            <button type="button" className={primary} disabled={pending} onClick={() => moveTo("en_route", "On my way.")}>On my way</button>
          )}
        </>
      );
      break;
    case "diagnosis":
      buttons = (
        <>
          <button type="button" className={secondary} disabled={pending} onClick={() => save(true)}>Save &amp; exit</button>
          <button type="button" className={middle} disabled={pending} onClick={() => moveTo("parts_required", "Marked: needs parts.")}>Need parts</button>
          <button type="button" className={primary} disabled={pending} onClick={() => moveTo("work_complete", "Job marked complete.")}>Complete job</button>
        </>
      );
      break;
    case "parts":
      buttons = (
        <>
          <button type="button" className={secondary} disabled={pending} onClick={() => save(false)}>Save</button>
          <button type="button" className={middle} disabled={pending} onClick={goQuote}>{invoice ? "View quote" : "Create quote"}</button>
          <button type="button" className={primary} disabled={pending} onClick={() => openRescheduleSheet("waiting_on_parts")}>Return visit</button>
        </>
      );
      break;
    case "approved":
      buttons = (
        <>
          <button type="button" className={secondary} disabled={pending} onClick={() => save(false)}>Save</button>
          <button type="button" className={middle} disabled={pending} onClick={() => moveTo("repairing", "Repair started.")}>Start repair</button>
          <button type="button" className={primary} disabled={pending} onClick={() => openRescheduleSheet("waiting_on_parts")}>Return visit</button>
        </>
      );
      break;
    case "repair":
      buttons = (
        <>
          <button type="button" className={secondary} disabled={pending} onClick={() => save(false)}>Save</button>
          <button type="button" className={middle} disabled={pending} onClick={goQuote}>{invoice ? "View invoice" : "Create invoice"}</button>
          <button type="button" className={primary} disabled={pending} onClick={() => moveTo("work_complete", "Work marked complete.")}>Complete</button>
        </>
      );
      break;
    case "invoice": {
      const canIssue = invoice?.status === "approved" && !invoice.issued;
      buttons = (
        <>
          {invoice ? (
            <a href={`/portal/${invoice.portalToken}/document`} target="_blank" rel="noreferrer" className={secondary}>Preview</a>
          ) : (
            <button type="button" className={secondary} disabled={pending} onClick={goQuote}>Preview</button>
          )}
          {canSendInvoice && invoice ? (
            <Link href={`/invoices?focus=${encodeURIComponent(invoice.id)}`} className={middle}>Send invoice</Link>
          ) : null}
          {canIssue ? (
            <form data-no-draft action={issueInvoiceForCompletedWorkAction} className="flex min-w-0 flex-1">
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="invoiceId" value={invoice!.id} />
              <SubmitButton pendingText="Submitting…" className={primary}>Submit job</SubmitButton>
            </form>
          ) : (
            <button type="button" className={primary} disabled={pending} onClick={() => moveTo("ready_to_invoice", "Submitted to the office.", true)}>Submit job</button>
          )}
        </>
      );
      break;
    }
  }

  return (
    <div
      className={`sticky bottom-[calc(84px+env(safe-area-inset-bottom))] z-40 mt-3.5 transition-opacity lg:bottom-4 ${keyboardOpen ? "pointer-events-none invisible opacity-0" : ""}`}
      aria-hidden={keyboardOpen || undefined}
    >
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`mb-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${message.tone === "error" ? "bg-[#FDECEA] text-[#B42318]" : "bg-[#E3F4FF] text-[#0A1A33]"}`}>
          {message.text}
        </p>
      ) : null}
      <div role="toolbar" aria-label="Job actions" className="cb-work-sticky flex gap-2 rounded-2xl p-2">
        {buttons}
      </div>
      {mode === "invoice" && !canSendInvoice ? <p className="mt-1 rounded-lg bg-white/90 px-2 py-1 text-center text-[12px] font-semibold text-[#0A1A33]">The office reviews and sends the invoice after you submit.</p> : null}
    </div>
  );
}
