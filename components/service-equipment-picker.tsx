"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEquipmentAction } from "@/lib/chillbros/equipment";

export type EquipmentOption = { id: string; label: string };
const field = "w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white";

export function ServiceEquipmentPicker({ customerId, equipment, value, onChange, disabled = false }: { customerId: string; equipment: EquipmentOption[]; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState<EquipmentOption[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ equipmentType: "", manufacturer: "", model: "", serialNumber: "", refrigerant: "", assetTag: "", notes: "" });
  const options = [...equipment, ...added.filter((unit) => !equipment.some((existing) => existing.id === unit.id))];
  const save = () => {
    setError("");
    startTransition(async () => {
      try {
        const result = await createEquipmentAction({ customerId, ...draft });
        if (!result.ok) { setError(result.error); return; }
        setAdded((current) => [...current, { id: result.data.equipmentId, label: [draft.equipmentType, draft.manufacturer, draft.model, draft.serialNumber ? `S/N ${draft.serialNumber}` : ""].filter(Boolean).join(" · ") }]);
        onChange(result.data.equipmentId); setOpen(false);
        setDraft({ equipmentType: "", manufacturer: "", model: "", serialNumber: "", refrigerant: "", assetTag: "", notes: "" });
        router.refresh();
      } catch { setError("Equipment could not be saved. Try again."); }
    });
  };
  return <section className="space-y-3 rounded-xl border border-[#2d7dff]/25 p-3">
    <label className="block space-y-1"><span className="text-sm font-semibold text-white">Equipment being serviced</span><select value={value} disabled={disabled || pending} onChange={(event) => onChange(event.target.value)} className={field}><option value="">No specific unit</option>{options.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
    <button type="button" disabled={disabled || pending} onClick={() => setOpen(!open)} className="rounded-lg border border-[#2d7dff]/30 px-3 py-2 text-sm text-[#d9fbff]">{open ? "Cancel new equipment" : "+ Add equipment"}</button>
    {open ? <div className="space-y-3"><p className="text-xs text-zinc-400">Save the unit to this customer’s asset registry, then save your document or service call to link it.</p><div className="grid gap-3 sm:grid-cols-2">{([['equipmentType', 'Equipment type *'], ['manufacturer', 'Manufacturer'], ['model', 'Model'], ['serialNumber', 'Serial number'], ['refrigerant', 'Refrigerant'], ['assetTag', 'Asset tag (optional)']] as const).map(([key, label]) => <label key={key} className="space-y-1 text-xs text-zinc-300"><span>{label}</span><input disabled={pending} value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} maxLength={120} className={field} /></label>)}</div><label className="block space-y-1 text-xs text-zinc-300"><span>Equipment notes</span><textarea disabled={pending} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} maxLength={2000} rows={3} className={field} /></label><button type="button" disabled={pending || disabled || !draft.equipmentType.trim()} onClick={save} className="rounded-xl bg-[#1B3FD0] px-4 py-3 font-semibold text-white disabled:opacity-50">{pending ? "Saving equipment…" : "Save new equipment"}</button></div> : null}
    {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
  </section>;
}
