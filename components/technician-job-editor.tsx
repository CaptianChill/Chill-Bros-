"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, PackagePlus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { updateTechnicianJobAction } from "@/lib/chillbros/operations";
import { addJobPartAtomicAction, removeJobPartAtomicAction, setJobPartQuantityAtomicAction } from "@/lib/chillbros/job-parts";
import type { Job, PartsCatalogItem } from "@/lib/chillbros/types";

type TechStatus = "scheduled" | "in_progress" | "completed";

export function TechnicianJobEditor({ job, partsCatalog }: { job: Job; partsCatalog: PartsCatalogItem[] }) {
  const router = useRouter();
  const mounted = useRef(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<TechStatus>(job.status === "completed" ? "completed" : job.status === "in_progress" ? "in_progress" : "scheduled");
  const [workPerformed, setWorkPerformed] = useState(job.workPerformed ?? "");
  const [laborHours, setLaborHours] = useState(String(job.laborHours ?? 0));
  const [driveHours, setDriveHours] = useState(String(job.driveHours ?? 0));
  const [partId, setPartId] = useState(partsCatalog[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [partQuantities, setPartQuantities] = useState<Record<string, string>>(() => Object.fromEntries(job.parts.map((p) => [p.id, String(p.quantity)])));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, refresh = true) => {
    setError(null); setMessage(null);
    startTransition(async () => { const result = await fn(); if (!result.ok) { setError(result.error ?? "Action failed."); return; } setMessage(success); if (refresh) router.refresh(); });
  };

  const saveTicket = (showMessage = false) => run(
    () => updateTechnicianJobAction({ jobId: job.id, status, workPerformed, laborHours: Number(laborHours || 0), driveHours: Number(driveHours || 0) }),
    status === "completed" ? "Job completed. Manager and Dispatch updated." : showMessage ? "Service ticket saved." : "Autosaved.",
    true,
  );

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const timer = window.setTimeout(() => saveTicket(false), 900);
    return () => window.clearTimeout(timer);
  }, [status, workPerformed, laborHours, driveHours]);

  useEffect(() => {
    const listener = () => saveTicket(true);
    window.addEventListener("chillbros-save", listener);
    return () => window.removeEventListener("chillbros-save", listener);
  }, [status, workPerformed, laborHours, driveHours]);

  return <div className="space-y-4">
    {error ? <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
    {message ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p> : null}
    <div className="flex items-center justify-between gap-3"><p className="text-xs text-zinc-500">Fields autosave after you stop typing.</p><span className={`text-xs ${pending ? "text-amber-200" : "text-emerald-300"}`}>{pending ? "Saving…" : "Saved"}</span></div>
    <div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1"><span className="text-xs text-zinc-400">Status</span><select value={status} onChange={(e) => setStatus(e.target.value as TechStatus)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white"><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label><label className="space-y-1"><span className="text-xs text-zinc-400">Labor hours</span><input type="number" min="0" step="0.25" value={laborHours} onChange={(e) => setLaborHours(e.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label><label className="space-y-1"><span className="text-xs text-zinc-400">Drive hours</span><input type="number" min="0" step="0.25" value={driveHours} onChange={(e) => setDriveHours(e.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label></div>
    <label className="block space-y-1"><span className="text-xs text-zinc-400">Diagnostics / work performed</span><textarea value={workPerformed} onChange={(e) => setWorkPerformed(e.target.value)} rows={5} placeholder="Diagnosis, readings, repair performed, recommendations..." className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label>
    <button onClick={() => saveTicket(true)} disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 px-4 py-2 text-sm text-[#d9fbff] disabled:opacity-50"><Save className="h-4 w-4" />Save now</button>

    <details className="group rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div><p className="font-medium text-white">Parts used</p><p className="text-xs text-zinc-500">{job.parts.length} part line{job.parts.length === 1 ? "" : "s"} logged</p></div><ChevronDown className="h-4 w-4 text-[#bafcfc] transition group-open:rotate-180" /></summary>
      <div className="mt-4 space-y-3"><div className="grid gap-2 sm:grid-cols-[1fr_90px_auto]"><select value={partId} onChange={(e) => setPartId(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white"><option value="">Choose inventory part</option>{partsCatalog.filter((p) => p.stock > 0).map((p) => <option key={p.id} value={p.id}>{p.name} • {p.partNumber} • {p.stock} available</option>)}</select><input aria-label="Quantity to add" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /><button onClick={() => run(() => addJobPartAtomicAction(job.id, partId, Number(quantity)), "Quantity added and inventory updated.")} disabled={pending || !partId} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-sm text-[#d9fbff] disabled:opacity-50"><PackagePlus className="h-4 w-4" />Add</button></div>
      <div className="space-y-2">{job.parts.length === 0 ? <p className="text-sm text-zinc-500">No parts logged.</p> : job.parts.map((part) => <div key={part.id} className="grid grid-cols-[1fr_82px_auto] items-center gap-2 rounded-xl border border-[#2d7dff]/10 bg-zinc-950 px-3 py-2"><div className="min-w-0"><p className="truncate text-sm text-white">{part.name}</p><p className="text-xs text-zinc-500">{part.partNumber} • ${part.retailPrice.toFixed(2)} ea.</p></div><input aria-label={`${part.name} quantity`} type="number" min="0" value={partQuantities[part.id] ?? String(part.quantity)} onChange={(e) => setPartQuantities((q) => ({ ...q, [part.id]: e.target.value }))} onBlur={() => { const next = Number(partQuantities[part.id] ?? part.quantity); if (next !== part.quantity) run(() => setJobPartQuantityAtomicAction(part.id, next), "Part quantity and stock updated."); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} className="rounded-lg border border-[#2d7dff]/20 bg-black px-2 py-2 text-center text-sm text-white" /><button onClick={() => run(() => removeJobPartAtomicAction(part.id), "Part removed and stock restored.")} disabled={pending} className="rounded-lg p-2 text-rose-300 disabled:opacity-50" aria-label={`Remove ${part.name}`}><Trash2 className="h-4 w-4" /></button></div>)}</div></div>
    </details>
  </div>;
}
