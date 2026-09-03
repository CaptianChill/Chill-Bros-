"use client";

import { useState, useTransition } from "react";
import { PackagePlus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { updateTechnicianJobAction } from "@/lib/chillbros/operations";
import { addJobPartAtomicAction, removeJobPartAtomicAction } from "@/lib/chillbros/job-parts";
import type { Job, PartsCatalogItem } from "@/lib/chillbros/types";

type TechStatus = "scheduled" | "in_progress" | "completed";

export function TechnicianJobEditor({ job, partsCatalog }: { job: Job; partsCatalog: PartsCatalogItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<TechStatus>(job.status === "completed" ? "completed" : job.status === "in_progress" ? "in_progress" : "scheduled");
  const [workPerformed, setWorkPerformed] = useState(job.workPerformed ?? "");
  const [laborHours, setLaborHours] = useState(String(job.laborHours ?? 0));
  const [driveHours, setDriveHours] = useState(String(job.driveHours ?? 0));
  const [partId, setPartId] = useState(partsCatalog[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setError(null); setMessage(null);
    startTransition(async () => { const result = await fn(); if (!result.ok) { setError(result.error ?? "Action failed."); return; } setMessage(success); router.refresh(); });
  };

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}{message ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1"><span className="text-xs text-zinc-400">Status</span><select value={status} onChange={(e) => setStatus(e.target.value as TechStatus)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white"><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label><label className="space-y-1"><span className="text-xs text-zinc-400">Labor hours</span><input type="number" min="0" step="0.25" value={laborHours} onChange={(e) => setLaborHours(e.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" /></label><label className="space-y-1"><span className="text-xs text-zinc-400">Drive hours</span><input type="number" min="0" step="0.25" value={driveHours} onChange={(e) => setDriveHours(e.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" /></label></div>
      <label className="block space-y-1"><span className="text-xs text-zinc-400">Diagnostics / work performed</span><textarea value={workPerformed} onChange={(e) => setWorkPerformed(e.target.value)} rows={5} placeholder="Diagnosis, readings, repair performed, recommendations..." className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" /></label>
      <button onClick={() => run(() => updateTechnicianJobAction({ jobId: job.id, status, workPerformed, laborHours: Number(laborHours), driveHours: Number(driveHours) }), status === "completed" ? "Job completed and service history updated." : "Service ticket saved.")} disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] disabled:opacity-50"><Save className="h-4 w-4" />Save service ticket</button>
      <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><p className="mb-3 font-medium text-white">Parts used</p><div className="grid gap-2 sm:grid-cols-[1fr_100px_auto]"><select value={partId} onChange={(e) => setPartId(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white"><option value="">Choose part</option>{partsCatalog.filter((p) => p.stock > 0).map((p) => <option key={p.id} value={p.id}>{p.name} • {p.partNumber} • stock {p.stock}</option>)}</select><input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" /><button onClick={() => run(() => addJobPartAtomicAction(job.id, partId, Number(quantity)), "Part added and stock adjusted atomically.")} disabled={pending || !partId} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-sm text-[#d9fbff] disabled:opacity-50"><PackagePlus className="h-4 w-4" />Add</button></div><div className="mt-3 space-y-2">{job.parts.length === 0 ? <p className="text-sm text-zinc-500">No parts logged.</p> : job.parts.map((part) => <div key={part.id} className="flex items-center justify-between rounded-xl border border-[#2d7dff]/10 bg-zinc-950 px-3 py-2 text-sm"><span className="text-white">{part.name} • qty {part.quantity}</span><button onClick={() => run(() => removeJobPartAtomicAction(part.id), "Part removed and stock restored atomically.")} disabled={pending} className="text-rose-300 disabled:opacity-50" aria-label={`Remove ${part.name}`}><Trash2 className="h-4 w-4" /></button></div>)}</div></div>
    </div>
  );
}
