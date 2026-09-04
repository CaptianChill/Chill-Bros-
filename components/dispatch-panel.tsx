"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Archive, CalendarPlus, CheckCircle2, Save, UserPlus, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { archiveUnusedCallAction, cancelCallAction, closeCallAction } from "@/lib/chillbros/job-admin-actions";
import { createCustomerAction, createJobAction } from "@/lib/chillbros/operations";
import { updateDispatchJobV2Action } from "@/lib/chillbros/job-workflow-v2";
import type { Customer, JobStatus } from "@/lib/chillbros/types";
import type { ActiveTechnician, DispatchJob } from "@/lib/chillbros/operations-queries";

const ACTIVE_STATUSES: JobStatus[] = ["scheduled", "in_progress"];

export function DispatchPanel({ customers, technicians, jobs }: { customers: Customer[]; technicians: ActiveTechnician[]; jobs: DispatchJob[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", address: "", phone: "", email: "" });
  const [jobForm, setJobForm] = useState({ customerId: customers[0]?.id ?? "", assignedTechId: "", location: "", scope: "", scheduledWindow: "" });
  const activeJobs = useMemo(() => jobs.filter((job) => ACTIVE_STATUSES.includes(job.status)), [jobs]);
  const closedJobs = useMemo(() => jobs.filter((job) => ["completed", "cancelled"].includes(job.status)), [jobs]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, refresh = true, after?: () => void) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Action failed.");
        return;
      }
      after?.();
      setMessage(success);
      if (refresh) router.refresh();
    });
  };

  const addCustomer = () => run(() => createCustomerAction(newCustomer), "Customer created.", true, () => setNewCustomer({ name: "", address: "", phone: "", email: "" }));
  const addJob = () => run(() => createJobAction({ ...jobForm, assignedTechId: jobForm.assignedTechId || null }), "Job dispatched.", true, () => setJobForm({ customerId: jobForm.customerId, assignedTechId: "", location: "", scope: "", scheduledWindow: "" }));
  const close = (jobId: string) => run(() => closeCallAction(jobId), "Call closed as completed.");
  const cancel = (jobId: string) => run(() => cancelCallAction(jobId), "Call cancelled.");
  const archive = (jobId: string) => run(() => archiveUnusedCallAction(jobId), "Unused call removed from the live board.");

  return <div className="space-y-5">
    {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
    {message ? <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}

    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
        <div className="mb-3 flex items-center gap-2 text-white"><UserPlus className="h-4 w-4 text-[#8ffafa]" /><h3 className="font-medium">New customer</h3></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input aria-label="Customer or business name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Customer / business name" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
          <input aria-label="Customer phone" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="Phone" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
          <input aria-label="Customer email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="Email" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
          <input aria-label="Customer address" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} placeholder="Address" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
        </div>
        <button onClick={addCustomer} disabled={pending || !newCustomer.name.trim()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-2.5 text-sm font-medium text-[#d9fbff] disabled:opacity-50"><UserPlus className="h-4 w-4" />Create customer</button>
      </div>

      <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
        <div className="mb-3 flex items-center gap-2 text-white"><CalendarPlus className="h-4 w-4 text-[#8ffafa]" /><h3 className="font-medium">Dispatch new job</h3></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <select aria-label="Customer for new job" value={jobForm.customerId} onChange={(e) => setJobForm({ ...jobForm, customerId: e.target.value })} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white"><option value="">Choose customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select aria-label="Assigned technician" value={jobForm.assignedTechId} onChange={(e) => setJobForm({ ...jobForm, assignedTechId: e.target.value })} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white"><option value="">Unassigned</option>{technicians.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select>
          <input aria-label="Job location" value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} placeholder="Job location" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
          <input aria-label="Scheduled window" value={jobForm.scheduledWindow} onChange={(e) => setJobForm({ ...jobForm, scheduledWindow: e.target.value })} placeholder="Schedule, e.g. Sep 4 • 8-10 AM" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
        </div>
        <textarea aria-label="Dispatch scope" value={jobForm.scope} onChange={(e) => setJobForm({ ...jobForm, scope: e.target.value })} placeholder="Dispatch scope / complaint" rows={3} className="mt-2 w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
        <button onClick={addJob} disabled={pending || !jobForm.customerId} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-2.5 text-sm font-medium text-[#d9fbff] disabled:opacity-50"><CalendarPlus className="h-4 w-4" />Create &amp; dispatch job</button>
      </div>
    </div>

    <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-medium text-white">Active dispatch board</h3><p className="text-xs text-zinc-500">Existing active call fields autosave after typing.</p></div><span className="text-sm text-[#bafcfc]">{activeJobs.length} open</span></div>
      {activeJobs.length === 0 ? <p className="text-sm text-zinc-400">No active calls.</p> : <div className="space-y-3">{activeJobs.map((job) => <JobRow key={job.id} job={job} technicians={technicians} pending={pending} onSave={(input, explicit) => run(() => updateDispatchJobV2Action(input), explicit ? "Dispatch saved." : "Dispatch autosaved.", explicit)} onClose={close} onCancel={cancel} onArchive={archive} />)}</div>}
    </div>

    {closedJobs.length > 0 ? <details className="group rounded-2xl border border-[#2d7dff]/20 bg-black/30 p-4"><summary className="cursor-pointer text-sm font-medium text-[#bafcfc]">Closed / cancelled calls ({closedJobs.length})</summary><p className="mt-2 text-xs text-zinc-500">Terminal calls are read-only. This prevents completed work from being accidentally reopened or cancelled.</p><div className="mt-3 space-y-3">{closedJobs.map((job) => <ClosedJobRow key={job.id} job={job} pending={pending} onArchive={archive} />)}</div></details> : null}
  </div>;
}

function JobRow({ job, technicians, pending, onSave, onClose, onCancel, onArchive }: { job: DispatchJob; technicians: ActiveTechnician[]; pending: boolean; onSave: (input: Parameters<typeof updateDispatchJobV2Action>[0], explicit: boolean) => void; onClose: (jobId: string) => void; onCancel: (jobId: string) => void; onArchive: (jobId: string) => void }) {
  const first = useRef(true);
  const [assignedTechId, setAssignedTechId] = useState(job.assignedTechId ?? "");
  const [status, setStatus] = useState<JobStatus>(ACTIVE_STATUSES.includes(job.status) ? job.status : "scheduled");
  const [location, setLocation] = useState(job.location ?? "");
  const [scope, setScope] = useState(job.scope ?? "");
  const [scheduledWindow, setScheduledWindow] = useState(job.scheduledWindow ?? "");
  const input = () => ({ jobId: job.id, assignedTechId: assignedTechId || null, status, location, scope, workPerformed: job.workPerformed ?? "", scheduledWindow });

  useEffect(() => { if (first.current) { first.current = false; return; } const timer = window.setTimeout(() => onSave(input(), false), 900); return () => window.clearTimeout(timer); }, [assignedTechId, status, location, scope, scheduledWindow]);
  useEffect(() => { const listener = () => onSave(input(), true); window.addEventListener("chillbros-save", listener); return () => window.removeEventListener("chillbros-save", listener); }, [assignedTechId, status, location, scope, scheduledWindow]);

  return <details className="group rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/70 p-3">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium text-white">{job.customerName}</p><p className="mt-1 truncate text-xs text-zinc-500">{job.assignedTechName ?? "Unassigned"} • {job.location ?? "No location"}</p></div><div className="shrink-0 text-right"><p className="text-xs uppercase text-[#bafcfc]">{status.replace(/_/g, " ")}</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-amber-200">Workflow: {job.workflowStage.replace(/_/g, " ")}</p></div></summary>
    <div className="mt-3">
      <div className="grid gap-2 md:grid-cols-4">
        <select aria-label="Assigned technician" value={assignedTechId} onChange={(e) => setAssignedTechId(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white"><option value="">Unassigned</option>{technicians.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select>
        <select aria-label="Active call status" value={status} onChange={(e) => setStatus(e.target.value as JobStatus)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white">{ACTIVE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
        <input aria-label="Job location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" />
        <input aria-label="Scheduled window" value={scheduledWindow} onChange={(e) => setScheduledWindow(e.target.value)} placeholder="Schedule" className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" />
      </div>
      <textarea aria-label="Dispatch scope" value={scope} onChange={(e) => setScope(e.target.value)} rows={2} placeholder="Scope" className="mt-2 w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" />
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => onSave(input(), true)} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff] disabled:opacity-50"><Save className="h-3.5 w-3.5" />Save now</button>
        <button onClick={() => onClose(job.id)} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 px-3 py-2 text-xs text-emerald-200 disabled:opacity-35"><CheckCircle2 className="h-3.5 w-3.5" />Close call</button>
        <button onClick={() => onCancel(job.id)} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-amber-500/25 px-3 py-2 text-xs text-amber-200 disabled:opacity-35"><XCircle className="h-3.5 w-3.5" />Cancel call</button>
        <button onClick={() => onArchive(job.id)} disabled={pending || status !== "scheduled"} className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 px-3 py-2 text-xs text-rose-300 disabled:opacity-35"><Archive className="h-3.5 w-3.5" />Delete unused</button>
      </div>
    </div>
  </details>;
}

function ClosedJobRow({ job, pending, onArchive }: { job: DispatchJob; pending: boolean; onArchive: (jobId: string) => void }) {
  return <div className="rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/65 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><p className="font-medium text-white">{job.customerName}</p><p className="mt-1 break-words text-xs text-zinc-500">{job.assignedTechName ?? "Unassigned"} • {job.location ?? "No location"}{job.scheduledWindow ? ` • ${job.scheduledWindow}` : ""}</p></div>
      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${job.status === "completed" ? "border-emerald-400/25 bg-emerald-400/5 text-emerald-200" : "border-amber-400/25 bg-amber-400/5 text-amber-200"}`}>{job.status}</span>
    </div>
    {job.scope ? <p className="mt-3 text-sm leading-6 text-zinc-300">{job.scope}</p> : null}
    {job.workPerformed ? <p className="mt-2 text-xs leading-5 text-zinc-500">Service notes: {job.workPerformed}</p> : null}
    {job.status === "cancelled" ? <button onClick={() => onArchive(job.id)} disabled={pending} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-500/20 px-3 py-2 text-xs text-rose-300 disabled:opacity-35"><Archive className="h-3.5 w-3.5" />Delete if unused</button> : null}
  </div>;
}
