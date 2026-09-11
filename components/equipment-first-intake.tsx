"use client";

import { useMemo, useState, useTransition } from "react";
import { ClipboardPlus, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";

import { createEquipmentLinkedJobAction } from "@/lib/chillbros/equipment-job-intake";
import type { EquipmentRecord } from "@/lib/chillbros/equipment-queries";
import type { ActiveTechnician } from "@/lib/chillbros/operations-queries";
import type { Customer } from "@/lib/chillbros/types";

export function EquipmentFirstIntake({ customers, technicians, equipment }: { customers: Customer[]; technicians: ActiveTechnician[]; equipment: EquipmentRecord[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ customerId: customers[0]?.id ?? "", equipmentId: "", assignedTechId: "", location: "", scope: "", scheduledWindow: "" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const customerEquipment = useMemo(() => equipment.filter((asset) => asset.customerId === form.customerId), [equipment, form.customerId]);

  const submit = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createEquipmentLinkedJobAction({
        ...form,
        equipmentId: form.equipmentId || null,
        assignedTechId: form.assignedTechId || null,
      });
      if (!result.ok) return setError(result.error);
      setMessage(`Service call created · Job ${result.jobId.slice(0, 8).toUpperCase()}`);
      setForm((current) => ({ customerId: current.customerId, equipmentId: "", assignedTechId: "", location: "", scope: "", scheduledWindow: "" }));
      router.refresh();
    });
  };

  return <div className="space-y-4">
    {error ? <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
    {message ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}

    <div className="grid gap-3 lg:grid-cols-2">
      <label className="space-y-1"><span className="text-xs text-zinc-400">Customer</span><select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, equipmentId: "" })} className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2.5 text-white"><option value="">Choose customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
      <label className="space-y-1"><span className="text-xs text-zinc-400">Equipment being serviced</span><select value={form.equipmentId} onChange={(e) => setForm({ ...form, equipmentId: e.target.value })} disabled={!form.customerId} className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2.5 text-white disabled:opacity-40"><option value="">No asset selected yet</option>{customerEquipment.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetTag ? `${asset.assetTag} • ` : ""}{asset.manufacturer ?? ""} {asset.model ?? ""} • {asset.equipmentType}</option>)}</select></label>
      <label className="space-y-1"><span className="text-xs text-zinc-400">Technician</span><select value={form.assignedTechId} onChange={(e) => setForm({ ...form, assignedTechId: e.target.value })} className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2.5 text-white"><option value="">Unassigned queue</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}</option>)}</select></label>
      <label className="space-y-1"><span className="text-xs text-zinc-400">Date / time window</span><input value={form.scheduledWindow} onChange={(e) => setForm({ ...form, scheduledWindow: e.target.value })} placeholder="Example: Sep 11 · 1–3 PM" className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2.5 text-white" /></label>
      <label className="space-y-1 lg:col-span-2"><span className="text-xs text-zinc-400">Service location</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Leave blank to use customer address" className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2.5 text-white" /></label>
      <label className="space-y-1 lg:col-span-2"><span className="text-xs text-zinc-400">Complaint / scope</span><textarea value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} rows={3} placeholder="What is the customer reporting?" className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2.5 text-white" /></label>
    </div>

    {form.customerId && customerEquipment.length === 0 ? <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-sm text-amber-100"><Wrench className="mr-2 inline h-4 w-4" />This customer has no equipment registered yet. You can still create the call, then add the asset in Equipment Center.</div> : null}

    <button onClick={submit} disabled={pending || !form.customerId} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-4 py-3 font-semibold text-white disabled:opacity-40"><ClipboardPlus className="h-4 w-4" />{pending ? "Creating…" : "Create linked service call"}</button>
  </div>;
}
