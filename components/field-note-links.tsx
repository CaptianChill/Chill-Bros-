"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getFieldNoteLinkOptionsAction, linkFieldNoteSubmissionAction } from "@/lib/chillbros/field-notes-actions";
import type { FieldNoteSubmission } from "@/lib/chillbros/field-notes-types";
type Option = { id: string; label: string };
export function FieldNoteLinks({ submission, customers, disabled }: { submission: FieldNoteSubmission; customers: { id: string; name: string }[]; disabled: boolean }) {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  const [customerId, setCustomerId] = useState(submission.customerId ?? "");
  const [jobId, setJobId] = useState(submission.jobId ?? ""); const [equipmentId, setEquipmentId] = useState(submission.equipmentId ?? "");
  const [options, setOptions] = useState<{ jobs: Option[]; equipment: Option[] } | null>(null); const [error, setError] = useState("");
  function load(id: string) {
    setCustomerId(id); setOptions(null); setError("");
    if (id !== customerId) { setJobId(""); setEquipmentId(""); }
    if (!id) return;
    startTransition(async () => { try { const result = await getFieldNoteLinkOptionsAction(id); if (result.ok) setOptions(result.data); else setError(result.error); } catch { setError("Could not load links. Retry."); } });
  }
  function save() {
    startTransition(async () => { try { const result = await linkFieldNoteSubmissionAction(submission.id, { customerId, jobId: jobId || null, equipmentId: equipmentId || null }, submission.updatedAt); if (!result.ok) setError(result.error); router.refresh(); } catch { setError("Could not save links. Refresh and retry."); } });
  }
  const style = "w-full rounded-xl border border-cyan-900 bg-black p-3 text-sm";
  return <details className="rounded-xl border border-cyan-900 p-3"><summary className="cursor-pointer">Link customer, job or equipment</summary><fieldset disabled={pending || disabled} className="mt-3 space-y-3">
    <label className="block">Customer<select className={style} value={customerId} onChange={e => load(e.target.value)}><option value="">Choose customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {!options ? <button type="button" disabled={!customerId} className="min-h-11 text-cyan-200 underline" onClick={() => load(customerId)}>Load this customer&apos;s jobs and equipment</button> : <>
      <label className="block">Job (optional)<select className={style} value={jobId} onChange={e => setJobId(e.target.value)}><option value="">No linked job</option>{options.jobs.map(j => <option key={j.id} value={j.id}>{j.label}</option>)}</select></label>
      <label className="block">Equipment (optional)<select className={style} value={equipmentId} onChange={e => setEquipmentId(e.target.value)}><option value="">No linked equipment</option>{options.equipment.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
    </>}
    {error ? <p role="alert" className="text-red-200">{error}</p> : null}
    <button type="button" disabled={!customerId || !options} onClick={save} className="min-h-11 rounded-xl bg-blue-700 px-4">Save links</button>
  </fieldset></details>;
}
