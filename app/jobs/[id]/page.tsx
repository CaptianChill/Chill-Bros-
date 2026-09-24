import Link from "next/link";
import { BadgeCheck, CalendarClock, Check, ChevronDown, ClipboardCheck, CreditCard, FileText, MapPin, Play, ReceiptText, UserRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ChangeTechnician, CloseCallButton, NextStepButton, TechNotes } from "@/components/job-screen-actions";
import { JobPartsCard } from "@/components/job-parts-card";
import { getPartsCatalog } from "@/lib/chillbros/queries";
import { SectionCard } from "@/components/section-card";
import { getActiveTechnicians } from "@/lib/chillbros/operations-queries";
import { getJobLifecycle } from "@/lib/chillbros/job-lifecycle-queries";
import { issueInvoiceForCompletedWorkAction, scheduleReturnVisitAction, startApprovedWorkAction } from "@/lib/chillbros/job-lifecycle-actions";
import { invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { partsProHref } from "@/lib/chillbros/parts-pro";
import { ctToday, displayTime, parseWindow } from "@/lib/chillbros/schedule-window";
import { JOB_ACTIVE_STATUSES, JOB_STATUS_LABELS, type JobStatus } from "@/lib/chillbros/types";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { rescheduleJobAction } from "@/app/schedule/actions";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string; invoice?: string }> };

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const when = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function stageLabel(stage: string) {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Progress stepper, mapped onto the existing job-status enum.
const STEPS = ["Scheduled", "On my way", "On site", "Work done", "Invoiced"] as const;
const ON_SITE: JobStatus[] = ["arrived", "in_progress", "diagnosing", "awaiting_approval", "approved", "parts_required", "return_visit_needed", "repairing"];
const WORK_DONE: JobStatus[] = ["work_complete", "ready_to_invoice", "completed"];

function currentStep(status: JobStatus, invoiceIssued: boolean) {
  if (invoiceIssued || status === "invoice_sent" || status === "paid") return 4;
  if (WORK_DONE.includes(status)) return 3;
  if (ON_SITE.includes(status)) return 2;
  if (status === "en_route") return 1;
  return 0;
}

// The field status each step moves to (the existing technician statuses).
const FIELD_NEXT: Record<number, { status: JobStatus; label: string }> = {
  0: { status: "en_route", label: "On my way" },
  1: { status: "arrived", label: "Arrived" },
  2: { status: "work_complete", label: "Mark work done" },
};

const TIMES = Array.from({ length: 29 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const primaryClass = "flex h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-[#1557B0] text-lg font-bold text-white shadow-[0_2px_8px_rgba(10,26,51,0.25)] transition hover:bg-[#0E3F82]";
const fieldClass = "mt-1 min-h-11 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 font-medium text-[#0A1A33]";

export default async function JobWorkspacePage({ params, searchParams }: Props) {
  const [{ id }, profile] = await Promise.all([params, getCurrentStaffProfile()]);
  if (!profile) redirect("/sign-in");

  const messages = await searchParams;
  const lifecycle = await getJobLifecycle(id);
  if (!lifecycle) notFound();
  if (profile.role === "technician" && lifecycle.job.assignedTechId !== profile.id) redirect("/technician");

  const canEditParts = profile.role === "manager" || (profile.role === "technician" && lifecycle.job.assignedTechId === profile.id);
  const [technicians, partsCatalog] = await Promise.all([
    profile.role === "technician" ? Promise.resolve([]) : getActiveTechnicians(),
    canEditParts ? getPartsCatalog() : Promise.resolve([]),
  ]);
  const { job, invoice, events, stage, nextAction } = lifecycle;
  const totals = invoice ? invoiceTotals(invoice) : null;
  const isOffice = profile.role === "manager" || profile.role === "office";
  const isField = profile.role === "manager" || profile.role === "technician";
  const invoiceIssued = Boolean(invoice?.issuedAt);
  const paid = invoice?.paymentStatus === "paid";
  const active = JOB_ACTIVE_STATUSES.includes(job.status);
  const step = currentStep(job.status, invoiceIssued);
  const slot = parseWindow(job.scheduledWindow);
  const fieldJob = { id: job.id, workPerformed: job.workPerformed, laborHours: job.laborHours, driveHours: job.driveHours };
  const quoteHref = `/jobs/${encodeURIComponent(job.id)}/quote`;
  const partsPro = partsProHref({ details: job.scope, back: `/jobs/${job.id}` });
  const fieldNext = FIELD_NEXT[step];

  // The one primary action for the job's next step.
  let primary: React.ReactNode = null;
  if (active && fieldNext) {
    primary = isField ? (
      <NextStepButton job={fieldJob} nextStatus={fieldNext.status} label={fieldNext.label} />
    ) : (
      <p className="cb-card p-3 text-center text-sm font-semibold text-[#2B3F5C]">Next: the technician taps &ldquo;{fieldNext.label}&rdquo;.</p>
    );
  } else if (step === 3 && !invoiceIssued) {
    if (invoice?.status === "approved") {
      primary = (
        <form data-no-draft action={issueInvoiceForCompletedWorkAction}>
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <button type="submit" className={primaryClass}>
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
            Create invoice
          </button>
        </form>
      );
    } else if (invoice?.status === "awaiting_approval" && isOffice) {
      primary = (
        <Link href={`/invoices?focus=${invoice.id}`} className={primaryClass}>
          <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          Finalize invoice
        </Link>
      );
    } else if (!invoice && isField) {
      primary = (
        <Link href={quoteHref} className={primaryClass}>
          <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          Create invoice
        </Link>
      );
    }
  } else if (invoiceIssued && isOffice && invoice) {
    primary = (
      <Link href={`/invoices?focus=${invoice.id}`} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#1557B0] bg-[#F8FAFD] font-semibold text-[#1557B0]">
        <ReceiptText className="h-5 w-5" aria-hidden="true" />
        {paid ? "Open paid invoice" : "Open invoice"}
      </Link>
    );
  }

  return (
    <AppShell title={job.customerName} description={job.scope || "Service call"}>
      <div className="cb-new space-y-3.5">
        {messages.success ? <p role="status" className="cb-card p-3 text-sm font-semibold text-[#0A7FC2]">{messages.success}</p> : null}
        {messages.error ? <p role="alert" className="cb-card p-3 text-sm font-semibold text-[#0B5CD5]">{messages.error}</p> : null}
        {messages.invoice ? <Link href={`/invoices?focus=${encodeURIComponent(messages.invoice)}`} className="cb-card block p-3 text-sm font-semibold text-[#1557B0] underline">Open invoice</Link> : null}

        <section aria-label="Job progress" className="cb-card p-3.5">
          <ol className="grid grid-cols-5">
            {STEPS.map((label, index) => {
              const done = index < step || (index === step && index === STEPS.length - 1);
              const current = index === step && !done;
              return (
                <li key={label} className="relative flex flex-col items-center text-center">
                  {index > 0 ? <span aria-hidden="true" className={`absolute right-1/2 top-[15px] h-[3px] w-full ${index <= step ? "bg-[#1557B0]" : "bg-[#0A1A33]/15"}`} /> : null}
                  <span
                    aria-hidden="true"
                    className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      done ? "bg-[#1557B0] text-white" : current ? "bg-[#F8FAFD] text-[#1557B0] ring-4 ring-[#9FD3FF]" : "bg-[#F8FAFD] text-[#2B3F5C] ring-1 ring-[#C7D3E2]"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className={`mt-1.5 text-[12px] leading-tight ${done || current ? "font-bold text-[#0A1A33]" : "font-medium text-[#2B3F5C]"}`}>
                    {label}
                    <span className="sr-only">{done ? " (done)" : current ? " (current step)" : ""}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          {!active && !invoiceIssued ? <p className="mt-3 text-center text-sm font-semibold text-[#2B3F5C]">This call is {JOB_STATUS_LABELS[job.status].toLowerCase()}.</p> : null}
        </section>

        {primary}

        <section aria-labelledby="details-title" className="cb-card overflow-hidden">
          <h2 id="details-title" className="border-b border-[#0A1A33]/10 px-3.5 py-3 text-[28px] leading-none">Details</h2>
          <ul className="divide-y divide-[#0A1A33]/10">
            <li className="flex min-h-[60px] items-center gap-3 px-3.5 py-2.5">
              <MapPin className="h-5 w-5 shrink-0 text-[#1557B0]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#2B3F5C]">Address</p>
                <p className="font-semibold text-[#0A1A33]">{job.location || "No address saved"}</p>
              </div>
              {job.location ? (
                <a href={`https://maps.apple.com/?q=${encodeURIComponent(job.location)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-semibold text-[#1557B0]">
                  Directions
                </a>
              ) : null}
            </li>
            <li className="flex min-h-[60px] flex-wrap items-center gap-3 px-3.5 py-2.5">
              <UserRound className="h-5 w-5 shrink-0 text-[#1557B0]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#2B3F5C]">Technician</p>
                <p className="font-semibold text-[#0A1A33]">{job.assignedTechName || "Unassigned"}</p>
              </div>
              {isOffice && active ? <ChangeTechnician jobId={job.id} currentTechId={job.assignedTechId} technicians={technicians.map((t) => ({ id: t.id, fullName: t.fullName }))} /> : null}
            </li>
            <li className="px-3.5 py-2.5">
              <div className="flex min-h-[40px] items-center gap-3">
                <CalendarClock className="h-5 w-5 shrink-0 text-[#1557B0]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[#2B3F5C]">Scheduled time</p>
                  <p className="font-semibold text-[#0A1A33]">
                    {slot
                      ? `${new Date(`${slot.date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })} · ${displayTime(slot.start)}–${displayTime(slot.end)}`
                      : job.scheduledWindow || "Not scheduled"}
                  </p>
                </div>
              </div>
              {isOffice && active ? (
                <details className="mt-1">
                  <summary className="ml-8 inline-flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-[#1557B0]">Reschedule</summary>
                  {/* rescheduleJobAction keeps the current technician (hidden field) and the job's status. */}
                  <form data-no-draft action={rescheduleJobAction} className="mt-1 grid grid-cols-2 gap-2">
                    <input type="hidden" name="jobId" value={job.id} />
                    <input type="hidden" name="assignedTechId" value={job.assignedTechId ?? ""} />
                    <label className="col-span-2 text-[13px] font-semibold text-[#0A1A33]">
                      Date
                      <input required type="date" name="date" defaultValue={slot?.date ?? ctToday()} className={fieldClass} />
                    </label>
                    <label className="text-[13px] font-semibold text-[#0A1A33]">
                      Start
                      <select name="start" defaultValue={slot?.start ?? "09:00"} className={fieldClass}>
                        {TIMES.map((t) => <option key={t} value={t}>{displayTime(t)}</option>)}
                      </select>
                    </label>
                    <label className="text-[13px] font-semibold text-[#0A1A33]">
                      End
                      <select name="end" defaultValue={slot?.end ?? "11:00"} className={fieldClass}>
                        {TIMES.map((t) => <option key={t} value={t}>{displayTime(t)}</option>)}
                      </select>
                    </label>
                    <button type="submit" className="col-span-2 min-h-12 rounded-xl bg-[#1557B0] font-semibold text-white">Save new time</button>
                  </form>
                </details>
              ) : null}
            </li>
          </ul>
        </section>

        <JobPartsCard jobId={job.id} parts={job.parts} catalog={partsCatalog} canEdit={canEditParts && active} canAddCustom={profile.role === "manager"} partsProHref={partsPro} />

        <section className="cb-card p-3.5">
          <TechNotes job={fieldJob} canEdit={isField && active} />
        </section>

        {isField || (isOffice && active) ? (
          <div className="grid grid-cols-2 gap-2.5">
            {isField ? (
              <Link href={quoteHref} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#1557B0] bg-[#F8FAFD] px-3 font-semibold text-[#1557B0] ${isOffice && active ? "" : "col-span-2"}`}>
                <FileText className="h-4 w-4" aria-hidden="true" />
                {invoice ? "View quote" : "Build quote"}
              </Link>
            ) : null}
            {isOffice && active ? (
              <div className={isField ? "" : "col-span-2"}>
                <CloseCallButton jobId={job.id} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <details className="group mt-3.5">
        <summary className="cb-new cb-card flex min-h-11 cursor-pointer list-none items-center justify-between px-3.5 py-2.5 font-semibold text-[#0A1A33]">
          More job details
          <ChevronDown className="h-5 w-5 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-3.5 space-y-3.5">
          <SectionCard eyebrow="Next action" title="Estimate & billing" description={nextAction}>
            {!invoice ? <p className="text-sm leading-6 text-zinc-300">{nextAction} Build the quote from this job when pricing is ready.</p> : invoice.status === "awaiting_approval" ? <div className="space-y-3"><p className="text-sm leading-6 text-zinc-400">The office can finalize this document, or the customer can approve it through their link.</p><a href={`/portal/${invoice.portalToken}`} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/45 px-4 py-3 font-semibold text-[#d9fbff]"><FileText className="h-4 w-4" />Open customer approval link</a></div> : !invoiceIssued ? <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] p-4"><div className="flex items-center gap-2 font-semibold text-emerald-100"><BadgeCheck className="h-4 w-4" />Estimate approved</div><p className="mt-1 text-sm leading-6 text-zinc-400">Do the work now or schedule the return trip. Either way this remains one job.</p></div>
              <form data-no-draft action={startApprovedWorkAction}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="invoiceId" value={invoice.id} /><button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/55 bg-[#2d7dff]/20 px-4 py-3 font-semibold text-white"><Play className="h-4 w-4" />Work Now / Continue Work</button></form>
              {isOffice ? <details open={stage === "approved_needs_action"} className="rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-4"><summary className="cursor-pointer font-semibold text-white">Schedule return visit</summary><form data-no-draft action={scheduleReturnVisitAction} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="invoiceId" value={invoice.id} /><label className="text-xs text-zinc-400">Date<input required type="date" name="date" defaultValue={ctToday()} className="mt-1 min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-white" /></label><label className="text-xs text-zinc-400">Technician<select name="technicianId" defaultValue={job.assignedTechId ?? ""} className="mt-1 min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-white"><option value="">Keep current assignment</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}</option>)}</select></label><label className="text-xs text-zinc-400">Start<input required type="time" name="start" defaultValue="09:00" className="mt-1 min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-white" /></label><label className="text-xs text-zinc-400">End<input required type="time" name="end" defaultValue="11:00" className="mt-1 min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-white" /></label><button type="submit" className="sm:col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 px-4 font-semibold text-[#d9fbff]"><CalendarClock className="h-4 w-4" />Save return visit</button></form></details> : null}
            </div> : !paid ? <div className="space-y-3"><p className="text-sm leading-6 text-zinc-400">Invoice issued · payment due. The customer sees the secure Pay Now action.</p><a href={`/portal/${invoice.portalToken}`} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/45 bg-[#2d7dff]/15 px-4 py-3 font-semibold text-[#d9fbff]"><CreditCard className="h-4 w-4" />Open customer payment page</a><Link href="/payments" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/25 px-4 py-3 text-sm text-white"><ReceiptText className="h-4 w-4" />Open payment center</Link></div> : <div className="text-center"><p className="text-lg font-semibold text-white">Paid and complete</p><a href={`/portal/${invoice.portalToken}/receipt`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 px-4 py-2 text-sm text-emerald-100"><ReceiptText className="h-4 w-4" />Open receipt</a></div>}
            {invoice ? <p className="mt-3 text-sm text-zinc-400">{invoice.invoiceNumber} · {money(totals?.total ?? 0)} · {stageLabel(stage)}</p> : null}
          </SectionCard>
          <SectionCard eyebrow="Job record" title="Service details" description="Service details, approved pricing and the visit history stay attached to this job.">
            <div className="space-y-3 text-sm leading-6">
              <p><span className="text-zinc-500">Complaint / scope:</span> <span className="text-zinc-200">{job.scope || "Not entered"}</span></p>
              <p><span className="text-zinc-500">Labor:</span> <span className="text-zinc-200">{job.laborHours} hr</span> <span className="ml-3 text-zinc-500">Drive:</span> <span className="text-zinc-200">{job.driveHours} hr</span></p>
              {invoice ? <details className="rounded-2xl border border-[#2d7dff]/15 bg-black/35 p-4"><summary className="cursor-pointer font-semibold text-white">Approved scope & pricing</summary><div className="mt-3 space-y-2">{invoice.lineItems.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 border-b border-[#2d7dff]/10 pb-2 text-sm last:border-none"><div><p className="text-zinc-200">{item.label}</p>{item.description ? <p className="mt-1 text-xs text-zinc-500">{item.description}</p> : null}</div><p className="shrink-0 text-white">{money(item.amount)}</p></div>)}</div></details> : null}
              <details open className="rounded-2xl border border-[#2d7dff]/15 bg-black/35 p-4"><summary className="cursor-pointer font-semibold text-white">Visit & workflow history</summary><div className="mt-4 space-y-3">{events.length === 0 ? <p className="text-sm text-zinc-500">No workflow events yet.</p> : events.map((event) => <div key={event.id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-white">{stageLabel(event.stage)}</p><p className="text-xs text-zinc-600">{when(event.createdAt)}</p></div><p className="mt-1 text-xs leading-5 text-zinc-400">{event.message}</p></div>)}</div></details>
              <Link href={`/jobs/${job.id}/diagnostics`} className="inline-flex text-sm font-semibold text-[#d9fbff] underline">Open field diagnostics</Link>
            </div>
          </SectionCard>
        </div>
      </details>
    </AppShell>
  );
}
