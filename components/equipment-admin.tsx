"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { createEquipmentAction, deleteEquipmentAction, updateEquipmentAction } from "@/lib/chillbros/equipment";
import type { EquipmentRecord } from "@/lib/chillbros/equipment-queries";
import type { Customer } from "@/lib/chillbros/types";

const emptyEquipment = (customerId = "") => ({ customerId, assetTag: "", equipmentType: "HVAC", manufacturer: "", model: "", serialNumber: "", refrigerant: "", notes: "" });

export function EquipmentAdmin({ customers, equipment, canDelete = true }: { customers: Customer[]; equipment: EquipmentRecord[]; canDelete?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEquipment(customers[0]?.id ?? ""));
  const grouped = useMemo(() => customers.map((customer) => ({ customer, items: equipment.filter((item) => item.customerId === customer.id) })).filter((group) => group.items.length > 0), [customers, equipment]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) => {
    setError(null); setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) { setError(result.error ?? "Action failed."); return; }
      after?.();
      setMessage(success);
      router.refresh();
    });
  };

  const addEquipment = () => run(
    () => createEquipmentAction(form),
    "Equipment added and saved under the customer.",
    () => setForm(emptyEquipment(form.customerId)),
  );

  const refresh = () => { setError(null); setMessage(null); router.refresh(); };

  return <div className="space-y-5">
    {error ? <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
    {message ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p> : null}

    <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><div><p className="font-medium text-white">Add equipment / asset</p><p className="text-xs text-zinc-500">Blank asset tags are generated automatically.</p></div><button type="button" onClick={refresh} className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff]"><RefreshCw className="h-3.5 w-3.5" />Refresh</button></div>
      <div className="grid gap-2 md:grid-cols-4">
        <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white"><option value="">Choose customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value })} placeholder="Asset tag (optional)" className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" />
        <input value={form.equipmentType} onChange={(e) => setForm({ ...form, equipmentType: e.target.value })} placeholder="Equipment type" className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" />
        <input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="Manufacturer" className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" />
        <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Model" className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" />
        <input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="Serial #" className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" />
        <input value={form.refrigerant} onChange={(e) => setForm({ ...form, refrigerant: e.target.value })} placeholder="Refrigerant" className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" />
      </div>
      <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Tonnage, voltage, install notes, warranty, location on site..." className="mt-2 w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white" />
      <button onClick={addEquipment} disabled={pending || !form.customerId || !form.equipmentType.trim()} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-2 text-sm text-[#d9fbff] disabled:opacity-50"><Plus className="h-4 w-4" />Add equipment</button>
    </div>

    {grouped.length === 0 ? <p className="text-sm text-zinc-500">No equipment records yet.</p> : <div className="space-y-3">{grouped.map(({ customer, items }) => <details key={customer.id} className="group rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-3"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div><p className="font-medium text-white">{customer.name}</p><p className="text-xs text-zinc-500">{items.length} registered asset{items.length === 1 ? "" : "s"}</p></div><ChevronDown className="h-4 w-4 text-[#bafcfc] transition group-open:rotate-180" /></summary><div className="mt-3 space-y-3">{items.map((item) => <EquipmentRow key={item.id} item={item} customers={customers} pending={pending} canDelete={canDelete} save={(value) => run(() => updateEquipmentAction(value), "Equipment updated.")} remove={() => run(() => deleteEquipmentAction(item.id), "Equipment deleted.")} />)}</div></details>)}</div>}
  </div>;
}

function EquipmentRow({ item, customers, pending, canDelete, save, remove }: { item: EquipmentRecord; customers: Customer[]; pending: boolean; canDelete: boolean; save: (input: Parameters<typeof updateEquipmentAction>[0]) => void; remove: () => void }) {
  const [value, setValue] = useState({ id: item.id, customerId: item.customerId, assetTag: item.assetTag ?? "", equipmentType: item.equipmentType, manufacturer: item.manufacturer ?? "", model: item.model ?? "", serialNumber: item.serialNumber ?? "", refrigerant: item.refrigerant ?? "", notes: item.notes ?? "" });
  return <details className="group/asset rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/70"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-white">{item.equipmentType}</p>{item.assetTag ? <span className="rounded-full border border-[#8ffafa]/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#bafcfc]">{item.assetTag}</span> : null}</div><p className="mt-1 truncate text-xs text-zinc-400">{[item.manufacturer, item.model, item.serialNumber].filter(Boolean).join(" • ") || "Details not recorded"}</p></div><ChevronDown className="h-4 w-4 shrink-0 text-[#bafcfc] transition group-open/asset:rotate-180" /></summary><div className="border-t border-[#2d7dff]/10 p-4"><div className="grid gap-2 md:grid-cols-4"><select value={value.customerId} onChange={(e) => setValue({ ...value, customerId: e.target.value })} className="rounded-xl border border-[#2d7dff]/15 bg-black px-3 py-2 text-sm text-white">{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input value={value.assetTag} onChange={(e) => setValue({ ...value, assetTag: e.target.value })} placeholder="Asset tag" className="rounded-xl border border-[#2d7dff]/15 bg-black px-3 py-2 text-sm text-white" /><input value={value.equipmentType} onChange={(e) => setValue({ ...value, equipmentType: e.target.value })} className="rounded-xl border border-[#2d7dff]/15 bg-black px-3 py-2 text-sm text-white" /><input value={value.manufacturer} onChange={(e) => setValue({ ...value, manufacturer: e.target.value })} placeholder="Manufacturer" className="rounded-xl border border-[#2d7dff]/15 bg-black px-3 py-2 text-sm text-white" /><input value={value.model} onChange={(e) => setValue({ ...value, model: e.target.value })} placeholder="Model" className="rounded-xl border border-[#2d7dff]/15 bg-black px-3 py-2 text-sm text-white" /><input value={value.serialNumber} onChange={(e) => setValue({ ...value, serialNumber: e.target.value })} placeholder="Serial #" className="rounded-xl border border-[#2d7dff]/15 bg-black px-3 py-2 text-sm text-white" /><input value={value.refrigerant} onChange={(e) => setValue({ ...value, refrigerant: e.target.value })} placeholder="Refrigerant" className="rounded-xl border border-[#2d7dff]/15 bg-black px-3 py-2 text-sm text-white" /></div><textarea value={value.notes} onChange={(e) => setValue({ ...value, notes: e.target.value })} rows={2} className="mt-2 w-full rounded-xl border border-[#2d7dff]/15 bg-black px-3 py-2 text-sm text-white" /><div className="mt-2 flex gap-2"><button onClick={() => save(value)} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff] disabled:opacity-50"><Save className="h-3.5 w-3.5" />Save</button>{canDelete ? <button onClick={remove} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 px-3 py-2 text-xs text-rose-300 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Delete</button> : null}</div></div></details>;
}
