"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, Navigation, PackagePlus, Save, Trash2, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";

import { updateTechnicianJobV2Action } from "@/lib/chillbros/job-workflow-v2";
import { addJobPartAtomicAction, removeJobPartAtomicAction, setJobPartQuantityAtomicAction } from "@/lib/chillbros/job-parts";
import { JOB_STATUS_LABELS, type Job, type JobStatus, type PartsCatalogItem } from "@/lib/chillbros/types";

const FIELD_STATUSES: JobStatus[] = ["en_route", "arrived", "work_complete"];

const NEXT_ACTION: Partial<Record<JobStatus, { status: JobStatus; label: string; icon: "nav" | "wrench" | "done" }>> = {
  new: { status: "en_route", label: "On my way", icon: "nav" },
  needs_scheduling: { status: "en_route", label: "On my way", icon: "nav" },
  scheduled: { status: "en_route", label: "On my way", icon: "nav" },
  dispatched: { status: "en_route", label: "On my way", icon: "nav" },
  en_route: { status: "arrived", label: "On site", icon: "nav" },
  ...Object.fromEntries(["in_progress", "arrived", "diagnosing", "awaiting_approval", "approved", "parts_required", "return_visit_needed", "repairing"].map(status => [status, { status: "work_complete", label: "Work done", icon: "done" }])),
};

export function TechnicianJobEditor({ job, partsCatalog }: { job: Job; partsCatalog: PartsCatalogItem[] }) {
  const router = useRouter();
  const mounted = useRef(false);
  const [pending, startTransition] = useTransition();
  const initialStatus = job.status;
  const [status, setStatus] = useState<JobStatus>(initialStatus);
  const [workPerformed, setWorkPerformed] = useState(job.workPerformed ?? "");
  const [laborHours, setLaborHours] = useState(String(job.laborHours ?? 0));
  const [driveHours, setDriveHours] = useState(String(job.driveHours ?? 0));
  const [partId, setPartId] = useState(partsCatalog[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [partQuantities, setPartQuantities] = useState<Record<string, string>>(() => Object.fromEntries(job.parts.map((p) => [p.id, String(p.quantity)])));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const nextAction = NEXT_ACTION[status];
  const stageIndex = useMemo(() => FIELD_STATUSES.indexOf(status), [status]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, refresh = true) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      let result;
      try { result = await fn(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Save failed."); return; }
      if (!result.ok) {
        setError(result.error ?? "Action failed.");
        return;
      }
      setMessage(success);
      if (refresh) router.refresh();
    });
  };

  const saveTicket = (showMessage = false) => run(
    () => updateTechnicianJobV2Action({ jobId: job.id, workPerformed, laborHours: Number(laborHours || 0), driveHours: Number(driveHours || 0) }),
    showMessage ? "Service notes saved." : "Autosaved.",
    true,
  );

  const changeStage = (nextStatus: JobStatus) => {
    run(async () => {
      const result = await updateTechnicianJobV2Action({ jobId: job.id, status: nextStatus, workPerformed, laborHours: Number(laborHours || 0), driveHours: Number(driveHours || 0) });
      if (result.ok) setStatus(nextStatus);
      return result;
    }, "Job updated: " + JOB_STATUS_LABELS[nextStatus] + ".");
  };

  const autosaveTicket = useEffectEvent(() => saveTicket(false));
  const saveFromHeader = useEffectEvent(() => saveTicket(true));

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = window.setTimeout(() => autosaveTicket(), 900);
    return () => window.clearTimeout(timer);
  }, [workPerformed, laborHours, driveHours]);

  useEffect(() => {
    const listener = () => saveFromHeader();
    window.addEventListener("chillbros-save", listener);
    return () => window.removeEventListener("chillbros-save", listener);
  }, []);

  const ActionIcon = nextAction?.icon === "nav" ? Navigation : nextAction?.icon === "done" ? CheckCircle2 : Wrench;

  return <div className="space-y-4">
    {error ? <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
    {message ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p> : null}

    <div className="rounded-2xl border border-[#2d7dff]/25 bg-black/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Current field stage</p>
          <p className="mt-1 text-xl font-semibold text-white">{JOB_STATUS_LABELS[status]}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs ${pending ? "border-amber-400/30 text-amber-200" : "border-emerald-400/25 text-emerald-200"}`}>{pending ? "Saving…" : "Synced"}</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-900"><div className="h-full rounded-full bg-[#2d7dff] transition-all" style={{ width: `${Math.max(8, ((stageIndex + 1) / FIELD_STATUSES.length) * 100)}%` }} /></div>
      {nextAction ? <button onClick={() => changeStage(nextAction.status)} disabled={pending} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/15 px-4 py-3 text-sm font-semibold text-[#e9ffff] disabled:opacity-50"><ActionIcon className="h-4 w-4" />{nextAction.label}</button> : null}
      <details className="mt-3"><summary className="cursor-pointer text-xs text-zinc-500">Manual stage override</summary><select value={status} onChange={(e) => changeStage(e.target.value as JobStatus)} className="mt-2 w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white">{!FIELD_STATUSES.includes(status) ? <option value={status} disabled>{JOB_STATUS_LABELS[status]}</option> : null}{FIELD_STATUSES.map((s) => <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>)}</select></details>
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1"><span className="text-xs text-zinc-400">Labor hours</span><input type="number" min="0" step="0.25" value={laborHours} onChange={(e) => setLaborHours(e.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label>
      <label className="space-y-1"><span className="text-xs text-zinc-400">Drive hours</span><input type="number" min="0" step="0.25" value={driveHours} onChange={(e) => setDriveHours(e.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label>
    </div>
    <label className="block space-y-1"><span className="text-xs text-zinc-400">Diagnostics / work performed</span><textarea value={workPerformed} onChange={(e) => setWorkPerformed(e.target.value)} rows={6} placeholder="Complaint, diagnosis, readings, repair performed, recommendations..." className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label>
    <button onClick={() => saveTicket(true)} disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 px-4 py-2.5 text-sm text-[#d9fbff] disabled:opacity-50"><Save className="h-4 w-4" />Save service notes</button>

    <details className="group rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div><p className="font-medium text-white">Parts used</p><p className="text-xs text-zinc-500">{job.parts.length} part line{job.parts.length === 1 ? "" : "s"} logged</p></div><ChevronDown className="h-4 w-4 text-[#bafcfc] transition group-open:rotate-180" /></summary>
      <div className="mt-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_90px_auto]"><select value={partId} onChange={(e) => setPartId(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white"><option value="">Choose inventory part</option>{partsCatalog.filter((p) => p.stock > 0).map((p) => <option key={p.id} value={p.id}>{p.name} • {p.partNumber} • {p.stock} available</option>)}</select><input aria-label="Quantity to add" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /><button onClick={() => run(() => addJobPartAtomicAction(job.id, partId, Number(quantity)), "Quantity added and inventory updated.")} disabled={pending || !partId} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-sm text-[#d9fbff] disabled:opacity-50"><PackagePlus className="h-4 w-4" />Add</button></div>
        <div className="space-y-2">{job.parts.length === 0 ? <p className="text-sm text-zinc-500">No parts logged.</p> : job.parts.map((part) => <div key={part.id} className="grid grid-cols-[1fr_82px_auto] items-center gap-2 rounded-xl border border-[#2d7dff]/10 bg-zinc-950 px-3 py-2"><div className="min-w-0"><p className="truncate text-sm text-white">{part.name}</p><p className="text-xs text-zinc-500">{part.partNumber} • ${part.retailPrice.toFixed(2)} ea.</p></div><input aria-label={`${part.name} quantity`} type="number" min="0" value={partQuantities[part.id] ?? String(part.quantity)} onChange={(e) => setPartQuantities((q) => ({ ...q, [part.id]: e.target.value }))} onBlur={() => { const next = Number(partQuantities[part.id] ?? part.quantity); if (next !== part.quantity) run(() => setJobPartQuantityAtomicAction(part.id, next), "Part quantity and stock updated."); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} className="rounded-lg border border-[#2d7dff]/20 bg-black px-2 py-2 text-center text-sm text-white" /><button onClick={() => run(() => removeJobPartAtomicAction(part.id), "Part removed and stock restored.")} disabled={pending} className="rounded-lg p-2 text-rose-300 disabled:opacity-50" aria-label={`Remove ${part.name}`}><Trash2 className="h-4 w-4" /></button></div>)}</div>
      </div>
    </details>
  </div>;
}
