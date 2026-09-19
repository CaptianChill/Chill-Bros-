import Link from "next/link";
import { ArrowLeft, BadgeCheck, CalendarClock, ClipboardCheck, CreditCard, FileText, MapPin, Play, ReceiptText, UserRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getActiveTechnicians } from "@/lib/chillbros/operations-queries";
import { completedLifecycleStepCount, getJobLifecycle, LIFECYCLE_STEPS } from "@/lib/chillbros/job-lifecycle-queries";
import { issueInvoiceForCompletedWorkAction, scheduleReturnVisitAction, startApprovedWorkAction } from "@/lib/chillbros/job-lifecycle-actions";
import { invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string; invoice?: string }> };

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const when = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function todayCt() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function stageLabel(stage: string) {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function JobWorkspacePage({ params, searchParams }: Props) {
  const [{ id }, profile] = await Promise.all([params, getCurrentStaffProfile()]);
  if (!profile) redirect("/sign-in");

  const messages = await searchParams;
  const lifecycle = await getJobLifecycle(id);
  if (!lifecycle) notFound();
  if (profile.role === "technician" && lifecycle.job.assignedTechId !== profile.id) redirect("/technician");

  const technicians = profile.role === "technician" ? [] : await getActiveTechnicians();
  const { job, invoice, events, stage, nextAction } = lifecycle;
  const completed = completedLifecycleStepCount(stage);
  const totals = invoice ? invoiceTotals(invoice) : null;
  const canSchedule = profile.role === "manager" || profile.role === "office";
  const invoiceIssued = Boolean(invoice?.issuedAt);
  const paid = invoice?.paymentStatus === "paid";

  return <AppShell title="Job Workspace">
    <div className="space-y-4">
      {messages.success ? <p className="text-sm text-emerald-200">{messages.success}</p> : null}
      {messages.error ? <p className="text-sm text-rose-200">{messages.error}</p> : null}
      {messages.invoice ? <Link href={`/invoices?focus=${encodeURIComponent(messages.invoice)}`} className="text-sm text-[#d9fbff] underline">Open invoice</Link> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={profile.role === "technician" ? "/technician" : "/dispatch"} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#2d7dff]/25 bg-black/35 px-3 py-2 text-sm text-[#d9fbff]"><ArrowLeft className="h-4 w-4" />Back</Link>
        <div className="flex flex-wrap items-center gap-2"><StatusPill tone={paid ? "emerald" : invoiceIssued ? "amber" : "cyan"}>{stageLabel(stage)}</StatusPill><span className="text-xs text-zinc-500">Job {job.id.slice(0, 8).toUpperCase()}</span></div>
      </div>

      <section className="rounded-3xl border border-[#2d7dff]/30 bg-black/50 p-4 shadow-[0_0_28px_rgba(45,125,255,0.10)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8ffafa]">Permanent job record</p><h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{job.customerName}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{nextAction}</p></div>
          {invoice ? <div className="min-w-48 rounded-2xl border border-[#2d7dff]/20 bg-black/50 p-3"><p className="text-xs text-zinc-500">Approved / invoiced total</p><p className="mt-1 text-2xl font-semibold text-[#bafcfc]">{money(totals?.total ?? 0)}</p><p className="mt-1 text-xs text-zinc-500">{invoice.invoiceNumber}</p></div> : null}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-xl border border-[#2d7dff]/15 bg-black/35 p-3 text-sm text-zinc-300"><MapPin className="h-4 w-4 shrink-0 text-[#8ffafa]" /><span className="truncate">{job.location || "No location saved"}</span></div>
          <div className="flex items-center gap-2 rounded-xl border border-[#2d7dff]/15 bg-black/35 p-3 text-sm text-zinc-300"><UserRound className="h-4 w-4 shrink-0 text-[#8ffafa]" /><span className="truncate">{job.assignedTechName || "Unassigned"}</span></div>
          <div className="flex items-center gap-2 rounded-xl border border-[#2d7dff]/15 bg-black/35 p-3 text-sm text-zinc-300"><CalendarClock className="h-4 w-4 shrink-0 text-[#8ffafa]" /><span className="truncate">{job.scheduledWindow || "No appointment set"}</span></div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-3">
        <div className="grid min-w-[720px] grid-cols-7 gap-2">
          {LIFECYCLE_STEPS.map((step, index) => {
            const done = completed > index;
            const current = completed === index;
            return <div key={step.key} className={`rounded-xl border px-2 py-3 text-center ${done ? "border-emerald-400/30 bg-emerald-400/[0.08]" : current ? "border-[#8ffafa]/50 bg-[#2d7dff]/15" : "border-zinc-800 bg-black/30"}`}><div className={`mx-auto mb-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-300 text-black" : current ? "bg-[#8ffafa] text-black" : "bg-zinc-900 text-zinc-500"}`}>{done ? "✓" : index + 1}</div><p className={`text-[11px] font-semibold ${done || current ? "text-white" : "text-zinc-600"}`}>{step.label}</p></div>;
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard eyebrow="Next action" title="Keep the job moving" description="The software should tell you what happens next instead of making you hunt for another module.">
          {!invoice ? <div className="space-y-3"><p className="text-sm leading-6 text-zinc-300">Diagnosis and service details stay on this job. Build the quote from the same record when pricing is ready.</p><Link href={`/technician?job=${encodeURIComponent(job.id)}`} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/45 bg-[#2d7dff]/15 px-4 py-3 font-semibold text-[#d9fbff]"><FileText className="h-4 w-4" />Open field workflow & build estimate</Link></div> : invoice.status === "awaiting_approval" ? <div className="space-y-3"><div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] p-4"><p className="font-semibold text-amber-100">Finalize or request customer approval</p><p className="mt-1 text-sm leading-6 text-zinc-400">The office can finalize and email this document, or the customer can approve it through their link.</p></div>{canSchedule ? <Link href={`/invoices?focus=${invoice.id}`} className="text-sm text-[#d9fbff] underline">Finalize the invoice</Link> : null}<a href={`/portal/${invoice.portalToken}`} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/45 px-4 py-3 font-semibold text-[#d9fbff]"><FileText className="h-4 w-4" />Open customer approval link</a></div> : !invoiceIssued ? <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] p-4"><div className="flex items-center gap-2 font-semibold text-emerald-100"><BadgeCheck className="h-4 w-4" />Estimate approved</div><p className="mt-1 text-sm leading-6 text-zinc-400">Do the work now or schedule the return trip. Either way this remains one job.</p></div>
            <form data-no-draft action={startApprovedWorkAction}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="invoiceId" value={invoice.id} /><button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/55 bg-[#2d7dff]/20 px-4 py-3 font-semibold text-white"><Play className="h-4 w-4" />Work Now / Continue Work</button></form>
            {canSchedule ? <details open={stage === "approved_needs_action"} className="rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-4"><summary className="cursor-pointer font-semibold text-white">Schedule return visit</summary><form data-no-draft action={scheduleReturnVisitAction} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="invoiceId" value={invoice.id} /><label className="text-xs text-zinc-400">Date<input required type="date" name="date" defaultValue={todayCt()} className="mt-1 min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-white" /></label><label className="text-xs text-zinc-400">Technician<select name="technicianId" defaultValue={job.assignedTechId ?? ""} className="mt-1 min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-white"><option value="">Keep current assignment</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}</option>)}</select></label><label className="text-xs text-zinc-400">Start<input required type="time" name="start" defaultValue="09:00" className="mt-1 min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-white" /></label><label className="text-xs text-zinc-400">End<input required type="time" name="end" defaultValue="11:00" className="mt-1 min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 text-white" /></label><button type="submit" className="sm:col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 px-4 font-semibold text-[#d9fbff]"><CalendarClock className="h-4 w-4" />Save return visit</button></form></details> : null}
            <form data-no-draft action={issueInvoiceForCompletedWorkAction} className="border-t border-[#2d7dff]/15 pt-4"><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="invoiceId" value={invoice.id} /><button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/[0.08] px-4 py-3 font-semibold text-emerald-100"><ClipboardCheck className="h-4 w-4" />Complete Work & Issue Final Invoice</button><p className="mt-2 text-center text-xs text-zinc-500">Use this only after the approved work is actually complete.</p></form>
          </div> : !paid ? <div className="space-y-3"><div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] p-4"><p className="font-semibold text-amber-100">Invoice issued · payment due</p><p className="mt-1 text-sm leading-6 text-zinc-400">The customer now sees the secure Pay Now action. Their receipt is generated after payment clears.</p></div><a href={`/portal/${invoice.portalToken}`} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/45 bg-[#2d7dff]/15 px-4 py-3 font-semibold text-[#d9fbff]"><CreditCard className="h-4 w-4" />Open customer payment page</a><Link href="/payments" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/25 px-4 py-3 text-sm text-white"><ReceiptText className="h-4 w-4" />Open payment center</Link></div> : <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.08] p-5 text-center"><BadgeCheck className="mx-auto h-8 w-8 text-emerald-300" /><p className="mt-2 text-lg font-semibold text-white">Paid and complete</p><p className="mt-1 text-sm text-zinc-400">The job, invoice and receipt remain together in this workspace.</p><a href={`/portal/${invoice.portalToken}/receipt`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 px-4 py-2 text-sm text-emerald-100"><ReceiptText className="h-4 w-4" />Open receipt</a></div>}
        </SectionCard>

        <SectionCard eyebrow="Job record" title="Everything in one place" description="Service details, approved pricing and the visit/workflow history stay attached to this permanent job.">
          <div className="space-y-3">
            <details open className="rounded-2xl border border-[#2d7dff]/15 bg-black/35 p-4"><summary className="cursor-pointer font-semibold text-white">Service details</summary><div className="mt-3 space-y-2 text-sm leading-6"><p><span className="text-zinc-500">Complaint / scope:</span> <span className="text-zinc-200">{job.scope || "Not entered"}</span></p><p><span className="text-zinc-500">Work performed:</span> <span className="text-zinc-200">{job.workPerformed || "Not entered yet"}</span></p><p><span className="text-zinc-500">Labor:</span> <span className="text-zinc-200">{job.laborHours} hr</span> <span className="ml-3 text-zinc-500">Drive:</span> <span className="text-zinc-200">{job.driveHours} hr</span></p></div></details>
            {invoice ? <details className="rounded-2xl border border-[#2d7dff]/15 bg-black/35 p-4"><summary className="cursor-pointer font-semibold text-white">Approved scope & pricing</summary><div className="mt-3 space-y-2">{invoice.lineItems.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 border-b border-[#2d7dff]/10 pb-2 text-sm last:border-none"><div><p className="text-zinc-200">{item.label}</p>{item.description ? <p className="mt-1 text-xs text-zinc-500">{item.description}</p> : null}</div><p className="shrink-0 text-white">{money(item.amount)}</p></div>)}</div></details> : null}
            <details open className="rounded-2xl border border-[#2d7dff]/15 bg-black/35 p-4"><summary className="cursor-pointer font-semibold text-white">Visit & workflow history</summary><div className="mt-4 space-y-3">{events.length === 0 ? <p className="text-sm text-zinc-500">No workflow events yet.</p> : events.map((event) => <div key={event.id} className="relative pl-5 before:absolute before:left-0 before:top-1.5 before:h-2.5 before:w-2.5 before:rounded-full before:bg-[#8ffafa]"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-white">{stageLabel(event.stage)}</p><p className="text-xs text-zinc-600">{when(event.createdAt)}</p></div><p className="mt-1 text-xs leading-5 text-zinc-400">{event.message}</p></div>)}</div></details>
          </div>
        </SectionCard>
      </div>
    </div>
  </AppShell>;
}
