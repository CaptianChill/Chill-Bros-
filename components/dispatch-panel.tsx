"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarPlus, Save, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { createCustomerAction, createJobAction, updateJobAction } from "@/lib/chillbros/operations";
import type { Customer, JobStatus } from "@/lib/chillbros/types";
import type { ActiveTechnician, DispatchJob } from "@/lib/chillbros/operations-queries";

const STATUSES: JobStatus[] = ["scheduled", "in_progress", "completed", "cancelled"];

export function DispatchPanel({ customers, technicians, jobs }: { customers: Customer[]; technicians: ActiveTechnician[]; jobs: DispatchJob[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", address: "", phone: "", email: "" });
  const [jobForm, setJobForm] = useState({ customerId: customers[0]?.id ?? "", assignedTechId: "", location: "", scope: "", scheduledWindow: "" });

  const activeJobs = useMemo(() => jobs.filter((job) => !["completed", "cancelled"].includes(job.status)), [jobs]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Action failed.");
        return;
      }
      setMessage(success);
      router.refresh();
    });
  };

  const addCustomer = () => run(
    () => createCustomerAction(newCustomer),
    "Customer created.",
  );

  const addJob = () => run(
    () => createJobAction({ ...jobForm, assignedTechId: jobForm.assignedTechId || null }),
    "Job dispatched.",
  );

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      {message ? <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border border-[#2d7dff]/20 bg-black/40 p-5">
          <div className="mb-4 flex items-center gap-2 text-white"><UserPlus className="h-4 w-4 text-[#8ffafa]" /><h3 className="font-medium">New customer</h3></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Customer / business name" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="Phone" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <input value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="Email" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <input value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} placeholder="Address" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white" />
          </div>
          <button onClick={addCustomer} disabled={pending || !newCustomer.name.trim()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 text-sm font-medium text-[#d9fbff] disabled:opacity-50"><UserPlus className="h-4 w-4" />Create customer</button>
        </div>

        <div className="rounded-3xl border border-[#2d7dff]/20 bg-black/40 p-5">
          <div className="mb-4 flex items-center gap-2 text-white"><CalendarPlus className="h-4 w-4 text-[#8ffafa]" /><h3 className="font-medium">Dispatch new job</h3></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={jobForm.customerId} onChange={(e) => setJobForm({ ...jobForm, customerId: e.target.value })} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white">
              <option value="">Choose customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={jobForm.assignedTechId} onChange={(e) => setJobForm({ ...jobForm, assignedTechId: e.target.value })} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white">
              <option value="">Unassigned</option>{technicians.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </select>
            <input value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} placeholder="Job location" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <input value={jobForm.scheduledWindow} onChange={(e) => setJobForm({ ...jobForm, scheduledWindow: e.target.value })} placeholder="Schedule, e.g. Sep 4 • 8-10 AM" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white" />
          </div>
          <textarea value={jobForm.scope} onChange={(e) => setJobForm({ ...jobForm, scope: e.target.value })} placeholder="Dispatch scope / complaint" rows={4} className="mt-3 w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white" />
          <button onClick={addJob} disabled={pending || !jobForm.customerId} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 text-sm font-medium text-[#d9fbff] disabled:opacity-50"><CalendarPlus className="h-4 w-4" />Create & dispatch job</button>
        </div>
      </div>

      <div className="rounded-3xl border border-[#2d7dff]/20 bg-black/40 p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-medium text-white">Active dispatch board</h3><span className="text-sm text-[#bafcfc]">{activeJobs.length} open</span></div>
        {jobs.length === 0 ? <p className="text-sm text-zinc-400">No jobs yet. Create the first one above.</p> : <div className="space-y-3">{jobs.map((job) => <JobRow key={job.id} job={job} technicians={technicians} pending={pending} onSave={(input) => run(() => updateJobAction(input), "Job updated.")} />)}</div>}
      </div>
    </div>
  );
}

function JobRow({ job, technicians, pending, onSave }: { job: DispatchJob; technicians: ActiveTechnician[]; pending: boolean; onSave: (input: Parameters<typeof updateJobAction>[0]) => void }) {
  const [assignedTechId, setAssignedTechId] = useState(job.assignedTechId ?? "");
  const [status, setStatus] = useState<JobStatus>(job.status);
  const [location, setLocation] = useState(job.location ?? "");
  const [scope, setScope] = useState(job.scope ?? "");
  const [scheduledWindow, setScheduledWindow] = useState(job.scheduledWindow ?? "");
  return (
    <div className="rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium text-white">{job.customerName}</p><p className="text-xs text-zinc-500">{job.id.slice(0, 8)} • {job.assignedTechName ?? "Unassigned"}</p></div><span className="text-xs uppercase text-[#bafcfc]">{status.replace(/_/g, " ")}</span></div>
      <div className="grid gap-3 md:grid-cols-4">
        <select value={assignedTechId} onChange={(e) => setAssignedTechId(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white"><option value="">Unassigned</option>{technicians.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value as JobStatus)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white">{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" />
        <input value={scheduledWindow} onChange={(e) => setScheduledWindow(e.target.value)} placeholder="Schedule" className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" />
      </div>
      <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={2} className="mt-3 w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" />
      <button onClick={() => onSave({ jobId: job.id, assignedTechId: assignedTechId || null, status, location, scope, workPerformed: job.workPerformed ?? "", scheduledWindow })} disabled={pending} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff] disabled:opacity-50"><Save className="h-3.5 w-3.5" />Save dispatch</button>
    </div>
  );
}
