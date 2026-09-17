"use client";

import { useMemo, useState, useTransition } from "react";
import { Archive, CalendarPlus, CheckCircle2, ChevronDown, MapPin, Save, UserPlus, Users, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { archiveUnusedCallAction, cancelCallAction, closeCallAction } from "@/lib/chillbros/job-admin-actions";
import { createCustomerAction, createJobAction } from "@/lib/chillbros/operations";
import { updateDispatchJobV2Action } from "@/lib/chillbros/job-workflow-v2";
import { JOB_STATUS_LABELS, type Customer, type JobStatus } from "@/lib/chillbros/types";
import type { ActiveTechnician, DispatchJob } from "@/lib/chillbros/operations-queries";

const EDITABLE_STATUSES: JobStatus[] = ["scheduled", "in_progress"];
const CLOSED_STATUSES: JobStatus[] = ["paid", "completed", "cancelled"];

function stageGroup(job: DispatchJob) {
  const stage = `${job.status} ${job.workflowStage}`.toLowerCase();
  if (!job.assignedTechId) return "unassigned";
  if (CLOSED_STATUSES.includes(job.status)) return "closed";
  if (job.status === "work_complete" || job.status === "ready_to_invoice") return "billing";
  if (stage.includes("invoice") || stage.includes("billing") || stage.includes("payment")) return "billing";
  if (stage.includes("approval") || stage.includes("parts") || stage.includes("return")) return "waiting";
  if (stage.includes("progress") || stage.includes("route") || stage.includes("arriv") || stage.includes("diagnos") || stage.includes("repair")) return "field";
  return "scheduled";
}

export function DispatchPanel({ customers, technicians, jobs }: { customers: Customer[]; technicians: ActiveTechnician[]; jobs: DispatchJob[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", address: "", phone: "", email: "" });
  const [jobForm, setJobForm] = useState({ customerId: customers[0]?.id ?? "", assignedTechId: "", location: "", scope: "", scheduledWindow: "" });

  const openJobs = useMemo(() => jobs.filter((job) => !CLOSED_STATUSES.includes(job.status)), [jobs]);
  const closedJobs = useMemo(() => jobs.filter((job) => CLOSED_STATUSES.includes(job.status)), [jobs]);
  const unassigned = useMemo(() => openJobs.filter((job) => !job.assignedTechId), [openJobs]);
  const fieldJobs = useMemo(() => openJobs.filter((job) => stageGroup(job) === "field"), [openJobs]);
  const waitingJobs = useMemo(() => openJobs.filter((job) => stageGroup(job) === "waiting"), [openJobs]);
  const billingJobs = useMemo(() => openJobs.filter((job) => stageGroup(job) === "billing"), [openJobs]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      let result;
      try { result = await fn(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Call update failed."); return; }
      if (!result.ok) return setError(result.error ?? "Action failed.");
      after?.();
      setMessage(success);
      router.refresh();
    });
  };

  const saveJob = (job: DispatchJob, assignedTechId: string, status: JobStatus, scheduledWindow: string) => run(
    () => updateDispatchJobV2Action({
      jobId: job.id,
      assignedTechId: assignedTechId || null,
      status,
      location: job.location ?? "",
      scope: job.scope ?? "",
      workPerformed: job.workPerformed ?? "",
      scheduledWindow,
    }),
    "Dispatch updated."
  );

  return <div className="space-y-4">
    {error ? <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
    {message ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}

    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
      <Metric label="Unassigned" value={unassigned.length} />
      <Metric label="Scheduled" value={openJobs.filter((job) => stageGroup(job) === "scheduled").length} />
      <Metric label="In Field" value={fieldJobs.length} />
      <Metric label="Waiting" value={waitingJobs.length} />
      <Metric label="Billing" value={billingJobs.length} />
    </div>

    <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
      <details className="rounded-2xl border border-[#2d7dff]/20 bg-black/45 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-white">
          <span className="flex items-center gap-2 font-medium"><UserPlus className="h-4 w-4 text-[#8ffafa]" />Quick customer intake</span>
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Customer / business" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
          <input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="Phone" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
          <input value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="Email" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
          <input value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} placeholder="Address" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
        </div>
        <button onClick={() => run(() => createCustomerAction(newCustomer), "Customer created.", () => setNewCustomer({ name: "", address: "", phone: "", email: "" }))} disabled={pending || !newCustomer.name.trim()} className="mt-3 w-full rounded-xl border border-[#2d7dff]/40 bg-[#2d7dff]/10 px-4 py-2.5 text-sm font-medium text-[#d9fbff] disabled:opacity-40">Create customer</button>
      </details>

      <div className="rounded-2xl border border-[#2d7dff]/25 bg-black/55 p-4">
        <div className="mb-3 flex items-center gap-2 text-white"><CalendarPlus className="h-4 w-4 text-[#8ffafa]" /><h3 className="font-medium">Create service call</h3></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={jobForm.customerId} onChange={(e) => setJobForm({ ...jobForm, customerId: e.target.value })} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white"><option value="">Choose customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={jobForm.assignedTechId} onChange={(e) => setJobForm({ ...jobForm, assignedTechId: e.target.value })} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white"><option value="">Unassigned queue</option>{technicians.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select>
          <input value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} placeholder="Location" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
          <input value={jobForm.scheduledWindow} onChange={(e) => setJobForm({ ...jobForm, scheduledWindow: e.target.value })} placeholder="Date / time window" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
        </div>
        <textarea value={jobForm.scope} onChange={(e) => setJobForm({ ...jobForm, scope: e.target.value })} rows={2} placeholder="Complaint / scope" className="mt-2 w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
        <button onClick={() => run(() => createJobAction({ ...jobForm, assignedTechId: jobForm.assignedTechId || null }), "Service call created.", () => setJobForm({ customerId: jobForm.customerId, assignedTechId: "", location: "", scope: "", scheduledWindow: "" }))} disabled={pending || !jobForm.customerId} className="mt-3 w-full rounded-xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-2.5 text-sm font-medium text-[#d9fbff] disabled:opacity-40">Create service call</button>
      </div>
    </div>

    <section className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-amber-200">Needs assignment</p><h3 className="mt-1 text-lg font-semibold text-white">Unassigned jobs</h3></div><span className="rounded-full border border-amber-400/25 px-2.5 py-1 text-xs text-amber-100">{unassigned.length}</span></div>
      {unassigned.length ? <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{unassigned.map((job) => <JobCard key={job.id} job={job} technicians={technicians} pending={pending} onSave={saveJob} onClose={(id) => run(() => closeCallAction(id), "Call closed.")} onCancel={(id) => run(() => cancelCallAction(id), "Call cancelled.")} onArchive={(id) => run(() => archiveUnusedCallAction(id), "Unused call removed.")} />)}</div> : <p className="text-sm text-zinc-500">Nothing waiting for assignment.</p>}
    </section>

    <section className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
      <div className="mb-3 flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-[#8ffafa]">Field workload</p><h3 className="mt-1 text-lg font-semibold text-white">Technician lanes</h3></div><Users className="h-5 w-5 text-[#8ffafa]" /></div>
      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        {technicians.map((tech) => {
          const techJobs = openJobs.filter((job) => job.assignedTechId === tech.id);
          return <div key={tech.id} className="rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/65 p-3">
            <div className="mb-3 flex items-center justify-between"><div><p className="font-medium text-white">{tech.fullName}</p><p className="text-xs text-zinc-500">{techJobs.length} active {techJobs.length === 1 ? "job" : "jobs"}</p></div><span className="rounded-full border border-[#2d7dff]/20 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-[#bafcfc]">{tech.role}</span></div>
            <div className="space-y-2">{techJobs.length ? techJobs.map((job) => <JobCard key={job.id} compact job={job} technicians={technicians} pending={pending} onSave={saveJob} onClose={(id) => run(() => closeCallAction(id), "Call closed.")} onCancel={(id) => run(() => cancelCallAction(id), "Call cancelled.")} onArchive={(id) => run(() => archiveUnusedCallAction(id), "Unused call removed.")} />) : <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-600">No assigned work</div>}</div>
          </div>;
        })}
      </div>
    </section>

    <section className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
      <div className="mb-3"><p className="text-xs uppercase tracking-[0.2em] text-[#8ffafa]">Lifecycle view</p><h3 className="mt-1 text-lg font-semibold text-white">Job pipeline</h3></div>
      <div className="grid gap-3 xl:grid-cols-4">
        <PipelineColumn title="Scheduled" jobs={openJobs.filter((job) => stageGroup(job) === "scheduled")} />
        <PipelineColumn title="In Field" jobs={fieldJobs} />
        <PipelineColumn title="Approval / Parts" jobs={waitingJobs} />
        <PipelineColumn title="Billing" jobs={billingJobs} />
      </div>
    </section>

    {closedJobs.length ? <details className="rounded-2xl border border-zinc-800 bg-black/30 p-4"><summary className="cursor-pointer text-sm font-medium text-zinc-300">Closed / cancelled ({closedJobs.length})</summary><div className="mt-3 grid gap-2 lg:grid-cols-2">{closedJobs.map((job) => <div key={job.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-medium text-white">{job.customerName}</p><p className="mt-1 text-xs text-zinc-500">{job.location ?? "No location"}</p></div><span className="text-xs uppercase text-zinc-400">{JOB_STATUS_LABELS[job.status]}</span></div></div>)}</div></details> : null}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-[#2d7dff]/15 bg-black/45 px-3 py-3 text-center"><p className="text-xl font-semibold text-white">{value}</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p></div>;
}

function JobCard({ job, technicians, pending, onSave, onClose, onCancel, onArchive, compact = false }: { job: DispatchJob; technicians: ActiveTechnician[]; pending: boolean; onSave: (job: DispatchJob, tech: string, status: JobStatus, schedule: string) => void; onClose: (id: string) => void; onCancel: (id: string) => void; onArchive: (id: string) => void; compact?: boolean }) {
  const [assignedTechId, setAssignedTechId] = useState(job.assignedTechId ?? "");
  const [status, setStatus] = useState<JobStatus>(job.status);
  const [scheduledWindow, setScheduledWindow] = useState(job.scheduledWindow ?? "");

  return <details className="rounded-xl border border-[#2d7dff]/15 bg-black/55 p-3">
    <summary className="cursor-pointer list-none">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium text-white">{job.customerName}</p><p className="mt-1 flex items-center gap-1 truncate text-xs text-zinc-500"><MapPin className="h-3 w-3 shrink-0" />{job.location ?? "No location"}</p>{!compact && job.scope ? <p className="mt-2 line-clamp-2 text-xs text-zinc-400">{job.scope}</p> : null}</div><span className="shrink-0 rounded-full border border-[#2d7dff]/20 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#bafcfc]">{job.workflowStage.replace(/_/g, " ")}</span></div>
    </summary>
    <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
      <select value={assignedTechId} onChange={(e) => setAssignedTechId(e.target.value)} className="w-full rounded-lg border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white"><option value="">Unassigned</option>{technicians.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select>
      <div className="grid grid-cols-2 gap-2"><select value={status} onChange={(e) => setStatus(e.target.value as JobStatus)} className="rounded-lg border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white">{!EDITABLE_STATUSES.includes(status) ? <option value={status}>{JOB_STATUS_LABELS[status]}</option> : null}{EDITABLE_STATUSES.map((s) => <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>)}</select><input value={scheduledWindow} onChange={(e) => setScheduledWindow(e.target.value)} placeholder="Schedule" className="rounded-lg border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white" /></div>
      <div className="grid grid-cols-2 gap-2"><button onClick={() => onSave(job, assignedTechId, status, scheduledWindow)} disabled={pending} className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#2d7dff]/30 px-2 py-2 text-xs text-[#d9fbff] disabled:opacity-40"><Save className="h-3.5 w-3.5" />Save</button><button onClick={() => onClose(job.id)} disabled={pending} className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-500/25 px-2 py-2 text-xs text-emerald-200 disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5" />Close call</button><button onClick={() => onCancel(job.id)} disabled={pending} className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-500/25 px-2 py-2 text-xs text-amber-200 disabled:opacity-40"><XCircle className="h-3.5 w-3.5" />Cancel</button><button onClick={() => onArchive(job.id)} disabled={pending || status !== "scheduled"} className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-500/20 px-2 py-2 text-xs text-rose-300 disabled:opacity-30"><Archive className="h-3.5 w-3.5" />Delete</button></div>
    </div>
  </details>;
}

function PipelineColumn({ title, jobs }: { title: string; jobs: DispatchJob[] }) {
  return <div className="rounded-xl border border-[#2d7dff]/15 bg-zinc-950/60 p-3"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-white">{title}</p><span className="text-xs text-zinc-500">{jobs.length}</span></div><div className="space-y-2">{jobs.length ? jobs.slice(0, 8).map((job) => <div key={job.id} className="rounded-lg border border-zinc-800 bg-black/40 p-2.5"><p className="truncate text-sm text-zinc-200">{job.customerName}</p><p className="mt-1 truncate text-[11px] text-zinc-600">{job.assignedTechName ?? "Unassigned"} · {job.scheduledWindow ?? "No time set"}</p></div>) : <p className="py-4 text-center text-xs text-zinc-600">No jobs</p>}</div></div>;
}
