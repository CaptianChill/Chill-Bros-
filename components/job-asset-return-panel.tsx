"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarClock, Link2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import { linkEquipmentToJobAction, scheduleJobReturnVisitAction } from "@/lib/chillbros/job-asset-actions";
import type { EquipmentRecord } from "@/lib/chillbros/equipment-queries";
import type { ActiveTechnician, DispatchJob } from "@/lib/chillbros/operations-queries";

function todayCt() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function JobAssetReturnPanel({ jobs, equipment, technicians }: { jobs: DispatchJob[]; equipment: EquipmentRecord[]; technicians: ActiveTechnician[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const activeJobs = useMemo(() => jobs.filter((job) => !["paid", "completed", "cancelled"].includes(job.status)), [jobs]);
  const [jobId, setJobId] = useState(activeJobs[0]?.id ?? "");
  const selectedJob = activeJobs.find((job) => job.id === jobId) ?? null;
  const customerEquipment = useMemo(() => equipment.filter((asset) => asset.customerId === selectedJob?.customerId), [equipment, selectedJob]);
  const [equipmentId, setEquipmentId] = useState("");
  const [date, setDate] = useState(todayCt());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [technicianId, setTechnicianId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return setError(result.error ?? "Action failed.");
      setMessage(success);
      router.refresh();
    });
  };

  return <div className="space-y-4">
    {error ? <p className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
    {message ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p> : null}

    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/45 p-4">
        <div className="mb-3 flex items-center gap-2"><Link2 className="h-4 w-4 text-[#8ffafa]" /><div><p className="font-medium text-white">Link equipment to job</p><p className="text-xs text-zinc-500">Permanent service history follows this exact asset.</p></div></div>
        <div className="space-y-2">
          <select value={jobId} onChange={(e) => { setJobId(e.target.value); setEquipmentId(""); }} className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white"><option value="">Choose job</option>{activeJobs.map((job) => <option key={job.id} value={job.id}>{job.customerName} • {job.location ?? "No location"}</option>)}</select>
          <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} disabled={!selectedJob} className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white disabled:opacity-40"><option value="">Choose customer equipment</option>{customerEquipment.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetTag ? `${asset.assetTag} • ` : ""}{asset.manufacturer ?? ""} {asset.model ?? ""} • {asset.equipmentType}</option>)}</select>
          {selectedJob && customerEquipment.length === 0 ? <p className="text-xs text-amber-200">This customer has no registered equipment yet. Add the asset in Equipment Center, then return here.</p> : null}
          <button onClick={() => run(() => linkEquipmentToJobAction({ jobId, equipmentId: equipmentId || null }), "Equipment linked to the permanent job record.")} disabled={pending || !jobId || !equipmentId} className="w-full rounded-xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 px-4 py-2.5 text-sm font-medium text-[#d9fbff] disabled:opacity-40">Link selected equipment</button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/45 p-4">
        <div className="mb-3 flex items-center gap-2"><RotateCcw className="h-4 w-4 text-[#8ffafa]" /><div><p className="font-medium text-white">Schedule return visit</p><p className="text-xs text-zinc-500">Keeps diagnosis, quote, parts and invoice under the same job.</p></div></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="sm:col-span-2 rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white"><option value="">Choose job</option>{activeJobs.map((job) => <option key={job.id} value={job.id}>{job.customerName} • {job.location ?? "No location"}</option>)}</select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
          <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white"><option value="">Keep current technician</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}</option>)}</select>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason / parts arriving / callback note" className="sm:col-span-2 rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
        </div>
        <button onClick={() => run(() => scheduleJobReturnVisitAction({ jobId, date, start, end, technicianId: technicianId || null, reason }), "Return visit scheduled on the same job.")} disabled={pending || !jobId} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 px-4 py-2.5 text-sm font-medium text-[#d9fbff] disabled:opacity-40"><CalendarClock className="h-4 w-4" />Save return visit</button>
      </div>
    </div>
  </div>;
}
