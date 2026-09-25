import Link from "next/link";
import { BadgeCheck, CalendarClock, ChevronDown, ClipboardCheck, CreditCard, FileText, Mail, MapPin, Phone, Play, ReceiptText, Sparkles, UserRound, Wrench } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DiagnosticReadingsPanel } from "@/components/diagnostic-readings-panel";
import { ChangeTechnician, CloseCallButton } from "@/components/job-screen-actions";
import { JobPartsCard } from "@/components/job-parts-card";
import { SectionCard } from "@/components/section-card";
import { WorkActionBar } from "@/components/work-page/action-bar";
import { DiagnosticNotes } from "@/components/work-page/diagnostic-notes";
import { PhotoSection } from "@/components/work-page/photo-section";
import { ReceiptsSection } from "@/components/work-page/receipts-section";
import { RepairReportForm } from "@/components/work-page/repair-report";
import { RescheduleButton, RescheduleSheet } from "@/components/work-page/reschedule-sheet";
import { SignatureSection } from "@/components/work-page/signature-section";
import { WorkHeader, type WorkMenuLink } from "@/components/work-page/work-header";
import { getDiagnosticReadings } from "@/lib/chillbros/diagnostic-readings";
import { getJobLifecycle } from "@/lib/chillbros/job-lifecycle-queries";
import { issueInvoiceForCompletedWorkAction, scheduleReturnVisitAction, startApprovedWorkAction } from "@/lib/chillbros/job-lifecycle-actions";
import { invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { getActiveTechnicians } from "@/lib/chillbros/operations-queries";
import { partsProHref } from "@/lib/chillbros/parts-pro";
import { getPartsCatalog } from "@/lib/chillbros/queries";
import { ctToday, displayTime, parseWindow } from "@/lib/chillbros/schedule-window";
import { JOB_ACTIVE_STATUSES, JOB_STATUS_LABELS } from "@/lib/chillbros/types";
import { actionBarMode, canCaptureSignature, fieldNextStatuses, technicianRescheduleStatus } from "@/lib/chillbros/work-page";
import { getJobReceipts, getLatestJobSignature, getRepairReports, getWorkPageContext } from "@/lib/chillbros/work-page-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { rescheduleJobAction } from "@/app/schedule/actions";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string; invoice?: string; reschedule?: string }> };

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const when = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function stageLabel(stage: string) {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const TIMES = Array.from({ length: 29 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const SHEET_TIMES = new Set(Array.from({ length: 31 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`));
const primaryClass = "flex h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-[#1557B0] text-lg font-bold text-white shadow-[0_2px_8px_rgba(10,26,51,0.25)] transition hover:bg-[#0E3F82]";
const fieldClass = "mt-1 min-h-11 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 font-medium text-[#0A1A33]";
const rowClass = "flex min-h-[56px] items-center gap-3 px-3.5 py-2.5";
const linkButton = "inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-semibold text-[#1557B0]";

// The single Work Page for a service call: everything the technician needs,
// top to bottom, with the office controls kept for manager/office users.
export default async function JobWorkspacePage({ params, searchParams }: Props) {
  const [{ id }, profile] = await Promise.all([params, getCurrentStaffProfile()]);
  if (!profile) redirect("/sign-in");

  const messages = await searchParams;
  const lifecycle = await getJobLifecycle(id);
  if (!lifecycle) notFound();
  if (profile.role === "technician" && lifecycle.job.assignedTechId !== profile.id) redirect("/technician");

  const { job, invoice, events, stage, nextAction } = lifecycle;
  const isTech = profile.role === "technician";
  const isOffice = profile.role === "manager" || profile.role === "office";
  const isField = profile.role === "manager" || isTech;
  const active = JOB_ACTIVE_STATUSES.includes(job.status);
  const canEditParts = profile.role === "manager" || (isTech && job.assignedTechId === profile.id);

  const [technicians, partsCatalog, context, receipts, signature, repairReports, readings] = await Promise.all([
    isTech ? Promise.resolve([]) : getActiveTechnicians(),
    canEditParts ? getPartsCatalog() : Promise.resolve([]),
    getWorkPageContext(job.id),
    getJobReceipts(job.id),
    getLatestJobSignature(job.id),
    getRepairReports(job.id),
    getDiagnosticReadings(job.id),
  ]);

  const totals = invoice ? invoiceTotals(invoice) : null;
  const invoiceIssued = Boolean(invoice?.issuedAt);
  const paid = invoice?.paymentStatus === "paid";
  const slot = parseWindow(job.scheduledWindow);
  const quoteHref = `/jobs/${encodeURIComponent(job.id)}/quote`;
  const partsPro = partsProHref({ details: job.scope, back: `/jobs/${job.id}` });
  const mode = actionBarMode(job.status, Boolean(invoice));
  const canReschedule = isField && active && technicianRescheduleStatus(job.status, "other") !== null;
  const canSign = isField && active && canCaptureSignature(job.status);
  const repairOpen = ["repairing", "work_complete", "ready_to_invoice"].includes(job.status);
  const customer = context.customer;
  const address = job.location || customer?.address || null;
  const lastNotesEvent = events.find((event) => event.stage.startsWith("tech_") && /saved service notes|notes\/time autosaved/.test(event.message));
  const lastRescheduled = events.find((event) => event.stage === "rescheduled");
  const sheetStart = slot && SHEET_TIMES.has(slot.start) ? slot.start : "09:00";
  const sheetEnd = slot && SHEET_TIMES.has(slot.end) && slot.end > sheetStart ? slot.end : "11:00";

  const menuLinks: WorkMenuLink[] = [
    { href: quoteHref, label: invoice ? (invoiceIssued ? "View invoice" : "View quote") : "Build quote" },
    ...(invoice ? [{ href: `/portal/${invoice.portalToken}/document`, label: "Preview customer document", external: true }] : []),
    { href: "#repair", label: "Repair / return notes" },
    { href: "#receipts", label: "Receipts (internal)" },
    { href: "/field-notes", label: "Field Notes (AI)" },
    { href: `/jobs/${job.id}/diagnostics`, label: "Full diagnostics history" },
    { href: `/tech-assist/${job.id}`, label: "Job intelligence" },
    { href: partsPro, label: "Parts Pro" },
    { href: "/timesheet", label: "Clock in / out" },
    ...(isTech ? [{ href: "/revenue-radar/handoffs", label: "Tech Requests" }] : []),
  ];

  // Office-only primary action (field users get the sticky action bar instead).
  let officePrimary: React.ReactNode = null;
  if (isOffice && !isField) {
    if (invoice?.status === "awaiting_approval") {
      officePrimary = <Link href={`/invoices?focus=${invoice.id}`} className={primaryClass}><ClipboardCheck className="h-5 w-5" aria-hidden="true" />Finalize invoice</Link>;
    } else if (invoice?.status === "approved" && !invoiceIssued && ["work_complete", "ready_to_invoice"].includes(job.status)) {
      officePrimary = (
        <form data-no-draft action={issueInvoiceForCompletedWorkAction}>
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <button type="submit" className={primaryClass}><ClipboardCheck className="h-5 w-5" aria-hidden="true" />Create invoice</button>
        </form>
      );
    } else if (invoiceIssued && invoice) {
      officePrimary = <Link href={`/invoices?focus=${invoice.id}`} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#1557B0] bg-[#F8FAFD] font-semibold text-[#1557B0]"><ReceiptText className="h-5 w-5" aria-hidden="true" />{paid ? "Open paid invoice" : "Open invoice"}</Link>;
    }
  }

  return (
    <AppShell title={job.customerName} description={job.scope || "Service call"}>
      <div className="cb-new space-y-3.5">
        <WorkHeader
          jobId={job.id}
          backHref={isField ? "/technician" : "/work"}
          customer={job.customerName}
          location={address}
          status={job.status}
          nextStatuses={isField && active ? fieldNextStatuses(job.status) : []}
          canReschedule={canReschedule}
          links={menuLinks}
        />
        {canReschedule ? <RescheduleSheet jobId={job.id} defaultDate={slot?.date ?? ctToday()} defaultStart={sheetStart} defaultEnd={sheetEnd} openOnLoad={messages.reschedule === "1"} /> : null}

        {messages.success ? <p role="status" className="cb-work-card p-3 text-sm font-semibold text-[#0A7FC2]">{messages.success}</p> : null}
        {messages.error ? <p role="alert" className="cb-work-card p-3 text-sm font-semibold text-[#B42318]">{messages.error}</p> : null}
        {messages.invoice && isOffice ? <Link href={`/invoices?focus=${encodeURIComponent(messages.invoice)}`} className="cb-work-card block p-3 text-sm font-semibold text-[#1557B0] underline">Open invoice</Link> : null}
        {!active ? <p className="cb-work-card p-3 text-center text-sm font-semibold text-[#2B3F5C]">This call is {JOB_STATUS_LABELS[job.status].toLowerCase()}. It stays in history and reports.</p> : null}

        {officePrimary}

        {/* 1. Customer / job */}
        <section aria-labelledby="job-title" className="cb-work-card overflow-hidden">
          <h2 id="job-title" className="border-b border-[#0A1A33]/10 px-3.5 py-2.5 text-lg font-bold">
            Customer &amp; job{context.jobNumber ? <span className="ml-2 text-sm font-semibold text-[#2B3F5C]">#{context.jobNumber}</span> : null}
          </h2>
          <ul className="divide-y divide-[#0A1A33]/10">
            <li className={rowClass}>
              <MapPin className="h-5 w-5 shrink-0 text-[#1557B0]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{job.customerName}</p>
                <p className="text-sm font-medium text-[#2B3F5C]">{address || "No address saved"}</p>
              </div>
              {address ? <a href={`https://maps.apple.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className={linkButton}>Maps</a> : null}
            </li>
            {customer?.phone || customer?.email ? (
              <li className={rowClass}>
                <Phone className="h-5 w-5 shrink-0 text-[#1557B0]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[#2B3F5C]">Primary contact</p>
                  <p className="truncate font-semibold">{customer.phone || customer.email}</p>
                </div>
                {customer.phone ? <a href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} className={linkButton}>Call</a> : null}
                {customer.email ? <a href={`mailto:${customer.email}`} aria-label="Email customer" className={linkButton}><Mail className="h-5 w-5" aria-hidden="true" /></a> : null}
              </li>
            ) : null}
            <li className={rowClass}>
              <Wrench className="h-5 w-5 shrink-0 text-[#1557B0]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#2B3F5C]">Equipment</p>
                {context.equipment ? (
                  <>
                    <p className="font-semibold">{context.equipment.label}</p>
                    <p className="text-sm font-medium text-[#2B3F5C]">{context.equipment.detail}{context.equipment.serialNumber ? ` · S/N ${context.equipment.serialNumber}` : ""}{context.equipment.refrigerant ? ` · ${context.equipment.refrigerant}` : ""}</p>
                  </>
                ) : (
                  <p className="font-semibold">No unit linked to this call</p>
                )}
              </div>
              {context.equipment && !isTech ? <Link href={`/equipment/${context.equipment.id}`} className={linkButton}>Open</Link> : null}
            </li>
            <li className="px-3.5 py-2.5">
              <p className="text-[13px] font-medium text-[#2B3F5C]">Complaint</p>
              <p className="font-semibold">{job.scope?.trim() || "No complaint recorded"}</p>
            </li>
            <li className="px-3.5 py-2.5">
              <div className="flex min-h-[40px] flex-wrap items-center gap-3">
                <CalendarClock className="h-5 w-5 shrink-0 text-[#1557B0]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[#2B3F5C]">Scheduled</p>
                  <p className="font-semibold">
                    {slot
                      ? `${new Date(`${slot.date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })} · ${displayTime(slot.start)}–${displayTime(slot.end)}`
                      : job.scheduledWindow || "Not scheduled"}
                  </p>
                  {lastRescheduled ? <p className="text-[12px] font-medium text-[#5B6B82]">{lastRescheduled.message}</p> : null}
                </div>
                {canReschedule ? <RescheduleButton /> : null}
              </div>
              {isOffice && active ? (
                <details className="mt-1">
                  <summary className="ml-8 inline-flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-[#1557B0]">Office reschedule</summary>
                  {/* rescheduleJobAction keeps the current technician (hidden field) and the job's status. */}
                  <form data-no-draft action={rescheduleJobAction} className="mt-1 grid grid-cols-2 gap-2">
                    <input type="hidden" name="jobId" value={job.id} />
                    <input type="hidden" name="assignedTechId" value={job.assignedTechId ?? ""} />
                    <label className="col-span-2 text-[13px] font-semibold">
                      Date
                      <input required type="date" name="date" defaultValue={slot?.date ?? ctToday()} className={fieldClass} />
                    </label>
                    <label className="text-[13px] font-semibold">
                      Start
                      <select name="start" defaultValue={slot?.start ?? "09:00"} className={fieldClass}>
                        {TIMES.map((t) => <option key={t} value={t}>{displayTime(t)}</option>)}
                      </select>
                    </label>
                    <label className="text-[13px] font-semibold">
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
            <li className={`${rowClass} flex-wrap`}>
              <UserRound className="h-5 w-5 shrink-0 text-[#1557B0]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#2B3F5C]">Technician</p>
                <p className="font-semibold">{job.assignedTechName || "Unassigned"}</p>
              </div>
              {isOffice && active ? <ChangeTechnician jobId={job.id} currentTechId={job.assignedTechId} technicians={technicians.map((t) => ({ id: t.id, fullName: t.fullName }))} /> : null}
            </li>
          </ul>
        </section>

        {/* 2. Diagnosis */}
        <section aria-label="Diagnosis" className="cb-work-card space-y-3 p-3.5">
          <DiagnosticNotes jobId={job.id} initialNotes={job.workPerformed ?? ""} canEdit={isField && active} lastSavedLabel={lastNotesEvent ? `Last saved ${when(lastNotesEvent.createdAt)}` : null} />
          <details className="group rounded-xl border border-[#C7D3E2]">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 font-semibold [&::-webkit-details-marker]:hidden">
              Readings ({readings.length})
              <ChevronDown className="h-5 w-5 transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="border-t border-[#C7D3E2] p-3">
              {isField && active ? (
                <DiagnosticReadingsPanel jobId={job.id} readings={readings.slice(0, 5)} tone="light" submitLabel="Save readings" />
              ) : (
                <Link href={`/jobs/${job.id}/diagnostics`} className="inline-flex min-h-11 items-center text-sm font-semibold text-[#1557B0]">Open readings history</Link>
              )}
            </div>
          </details>
          <Link href="/field-notes" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#1557B0]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Photograph handwritten notes with Field Notes (AI)
          </Link>
        </section>

        {/* 3. Before photos */}
        <PhotoSection jobId={job.id} phase="before" photos={job.beforePhotos} canUpload={isField && active} />

        {/* 4. Parts */}
        <JobPartsCard
          jobId={job.id}
          parts={job.parts}
          catalog={partsCatalog}
          canEdit={canEditParts && active}
          canAddCustom={profile.role === "manager"}
          canAddNeedToOrder={canEditParts && active}
          partMeta={context.partMeta}
          partsProHref={partsPro}
          tone="solid"
        />

        {/* 5. Repair / return notes */}
        <details id="repair" open={repairOpen || undefined} className="cb-work-card group scroll-mt-24">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-3.5 py-3 text-lg font-bold">
            Repair / return notes{repairReports.length ? ` (${repairReports.length})` : ""}
            <ChevronDown className="h-5 w-5 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-3 border-t border-[#0A1A33]/10 px-3.5 py-3">
            <RepairReportForm jobId={job.id} reports={repairReports} canEdit={isField && active} />
            {isField && active ? (
              <details className="group/final rounded-xl border border-[#C7D3E2]">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 font-semibold [&::-webkit-details-marker]:hidden">
                  Final readings
                  <ChevronDown className="h-5 w-5 transition group-open/final:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-[#C7D3E2] p-3">
                  <DiagnosticReadingsPanel jobId={job.id} readings={[]} tone="light" showHistory={false} submitLabel="Save final readings" notesPlaceholder="Final readings notes (after repair)" />
                </div>
              </details>
            ) : null}
          </div>
        </details>

        {/* 6. After photos */}
        <PhotoSection jobId={job.id} phase="after" photos={job.afterPhotos} canUpload={isField && active} />

        {/* 7. Receipts — internal only */}
        <ReceiptsSection jobId={job.id} receipts={receipts} canAdd={active} canToggleInvoice={isOffice} />

        {/* 8. Customer approval / signature — only once the repair is under way or done */}
        {canSign || signature ? <SignatureSection jobId={job.id} latest={signature} canCapture={canSign} /> : null}

        <div className="grid grid-cols-2 gap-2.5">
          <Link href={quoteHref} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#1557B0] bg-white px-3 font-semibold text-[#1557B0] ${isOffice && active ? "" : "col-span-2"}`}>
            <FileText className="h-4 w-4" aria-hidden="true" />
            {invoice ? (invoiceIssued ? "View invoice" : "View quote") : "Build quote"}
          </Link>
          {isOffice && active ? <CloseCallButton jobId={job.id} /> : null}
        </div>

        {isField ? <WorkActionBar jobId={job.id} status={job.status} mode={mode} invoice={invoice ? { id: invoice.id, status: invoice.status, portalToken: invoice.portalToken, issued: invoiceIssued } : null} quoteHref={quoteHref} canSendInvoice={isOffice} /> : null}
      </div>

      <details className="group mt-3.5">
        <summary className="cb-new cb-work-card flex min-h-11 cursor-pointer list-none items-center justify-between px-3.5 py-2.5 font-semibold text-[#0A1A33]">
          More job details
          <ChevronDown className="h-5 w-5 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-3.5 space-y-3.5">
          <SectionCard eyebrow="Next action" title="Estimate & billing" description={nextAction}>
            {!invoice ? <p className="text-sm leading-6 text-zinc-300">{nextAction} Build the quote from this job when pricing is ready.</p> : invoice.status === "awaiting_approval" ? <div className="space-y-3"><p className="text-sm leading-6 text-zinc-400">The office can finalize this document, or the customer can approve it through their link.</p><a href={`/portal/${invoice.portalToken}`} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/45 px-4 py-3 font-semibold text-[#d9fbff]"><FileText className="h-4 w-4" />Open customer approval link</a></div> : !invoiceIssued ? <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] p-4"><div className="flex items-center gap-2 font-semibold text-emerald-100"><BadgeCheck className="h-4 w-4" />Estimate approved</div><p className="mt-1 text-sm leading-6 text-zinc-400">Do the work now or schedule the return trip. Either way this remains one job.</p></div>
              <form data-no-draft action={startApprovedWorkAction}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="invoiceId" value={invoice.id} /><button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/55 bg-[#2d7dff]/20 px-4 py-3 font-semibold text-white"><Play className="h-4 w-4" />Work Now / Continue Work</button></form>
              {isOffice ? <details open={stage === "approved_needs_action"} className="rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-4"><summary className="cursor-pointer font-semibold text-white">Schedule return visit</summary><form data-no-draft action={scheduleReturnVisitAction} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="invoiceId" value={invoice.id} /><label className="text-xs text-zinc-400">Date<input required type="date" name="date" defaultValue={ctToday()} className="mt-1 min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-white" /></label><label className="text-xs text-zinc-400">Technician<select name="technicianId" defaultValue={job.assignedTechId ?? ""} className="mt-1 min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-white"><option value="">Keep current assignment</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}</option>)}</select></label><label className="text-xs text-zinc-400">Start<input required type="time" name="start" defaultValue="09:00" className="mt-1 min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-white" /></label><label className="text-xs text-zinc-400">End<input required type="time" name="end" defaultValue="11:00" className="mt-1 min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-white" /></label><button type="submit" className="sm:col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 px-4 font-semibold text-[#d9fbff]"><CalendarClock className="h-4 w-4" />Save return visit</button></form></details> : null}
            </div> : !paid ? <div className="space-y-3"><p className="text-sm leading-6 text-zinc-400">Invoice issued · payment due. The customer sees the secure Pay Now action.</p><a href={`/portal/${invoice.portalToken}`} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/45 bg-[#2d7dff]/15 px-4 py-3 font-semibold text-[#d9fbff]"><CreditCard className="h-4 w-4" />Open customer payment page</a>{isOffice ? <Link href="/payments" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/25 px-4 py-3 text-sm text-white"><ReceiptText className="h-4 w-4" />Open payment center</Link> : null}</div> : <div className="text-center"><p className="text-lg font-semibold text-white">Paid and complete</p><a href={`/portal/${invoice.portalToken}/receipt`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 px-4 py-2 text-sm text-emerald-100"><ReceiptText className="h-4 w-4" />Open receipt</a></div>}
            {invoice ? <p className="mt-3 text-sm text-zinc-400">{invoice.invoiceNumber} · {money(totals?.total ?? 0)} · {stageLabel(stage)}</p> : null}
          </SectionCard>
          <SectionCard eyebrow="Job record" title="Service details" description="Service details, approved pricing and the visit history stay attached to this job.">
            <div className="space-y-3 text-sm leading-6">
              <p><span className="text-zinc-500">Complaint / scope:</span> <span className="text-zinc-200">{job.scope || "Not entered"}</span></p>
              <p><span className="text-zinc-500">Labor:</span> <span className="text-zinc-200">{job.laborHours} hr</span> <span className="ml-3 text-zinc-500">Drive:</span> <span className="text-zinc-200">{job.driveHours} hr</span></p>
              {invoice ? <details className="rounded-2xl border border-[#2d7dff]/15 bg-black/35 p-4"><summary className="cursor-pointer font-semibold text-white">Approved scope & pricing</summary><div className="mt-3 space-y-2">{invoice.lineItems.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 border-b border-[#2d7dff]/10 pb-2 text-sm last:border-none"><div><p className="text-zinc-200">{item.label}</p>{item.description ? <p className="mt-1 text-xs text-zinc-500">{item.description}</p> : null}</div><p className="shrink-0 text-white">{money(item.amount)}</p></div>)}</div></details> : null}
              <details open className="rounded-2xl border border-[#2d7dff]/15 bg-black/35 p-4"><summary className="cursor-pointer font-semibold text-white">Visit & workflow history</summary><div className="mt-4 space-y-3">{events.length === 0 ? <p className="text-sm text-zinc-500">No workflow events yet.</p> : events.filter((event) => event.stage !== "diagnostic_readings" && event.stage !== "repair_report").map((event) => <div key={event.id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-white">{stageLabel(event.stage)}</p><p className="text-xs text-zinc-600">{when(event.createdAt)}</p></div><p className="mt-1 text-xs leading-5 text-zinc-400">{event.message}</p></div>)}</div></details>
              <Link href={`/jobs/${job.id}/diagnostics`} className="inline-flex text-sm font-semibold text-[#d9fbff] underline">Open field diagnostics</Link>
            </div>
          </SectionCard>
        </div>
      </details>
    </AppShell>
  );
}
