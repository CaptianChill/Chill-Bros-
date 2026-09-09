"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Plus, Search, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { createCustomerIntakeAction } from "@/lib/chillbros/customer-intake";
import type { EquipmentRecord } from "@/lib/chillbros/equipment-queries";
import type { ActiveTechnician, DispatchJob } from "@/lib/chillbros/operations-queries";
import type { Customer } from "@/lib/chillbros/types";

const emptyIntake = () => ({ name: "", phone: "", email: "", address: "", intakeNotes: "", createServiceCall: false, assignedTechId: "", location: "", scheduledWindow: "", scope: "" });

export function CustomerCenterCompact({ customers, technicians, equipment, jobs }: { customers: Customer[]; technicians: ActiveTechnician[]; equipment: EquipmentRecord[]; jobs: DispatchJob[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyIntake());
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => customers.map((customer) => {
    const customerEquipment = equipment.filter((item) => item.customerId === customer.id);
    const customerJobs = jobs.filter((job) => job.customerId === customer.id);
    const openJobs = customerJobs.filter((job) => ["scheduled", "in_progress"].includes(job.status));
    const haystack = [customer.name, customer.phone, customer.email, customer.address, ...customerEquipment.flatMap((item) => [item.assetTag, item.manufacturer, item.model, item.serialNumber])].filter(Boolean).join(" ").toLowerCase();
    return { customer, customerEquipment, customerJobs, openJobs, haystack };
  }), [customers, equipment, jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((row) => row.haystack.includes(q)) : rows;
  }, [query, rows]);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await createCustomerIntakeAction({ ...form, assignedTechId: form.assignedTechId || null });
      if (!result.ok) return setError(result.error);
      setForm(emptyIntake());
      setShowNew(false);
      router.refresh();
    });
  };

  return <div className="mx-auto max-w-5xl space-y-2.5">
    <div className="sticky top-[7.4rem] z-30 rounded-2xl border border-[#2d7dff]/30 bg-[#020407]/95 p-2.5 shadow-[0_8px_28px_rgba(0,0,0,.45)] backdrop-blur-xl">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8ffafa]/65"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search customers..." className="h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black/55 pl-9 pr-3 text-sm text-white outline-none focus:border-[#8ffafa]/55"/></div>
        <button type="button" onClick={()=>setShowNew((v)=>!v)} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#8ffafa]/45 bg-[#2d7dff]/15 px-3 text-xs font-semibold text-white"><Plus className="h-4 w-4"/><span className="hidden sm:inline">New Customer</span><span className="sm:hidden">New</span></button>
      </div>
      <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-zinc-500"><span>{filtered.length} customers</span><span>Tap a customer for details</span></div>
    </div>

    {showNew ? <section className="rounded-2xl border border-[#8ffafa]/30 bg-black/55 p-3">
      <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold text-white"><UserPlus className="h-4 w-4 text-[#8ffafa]"/>New customer</div><button type="button" onClick={()=>setShowNew(false)} className="rounded-lg p-1.5 text-zinc-400"><X className="h-4 w-4"/></button></div>
      {error ? <p className="mb-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-200">{error}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Customer / business name *" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2.5 text-sm text-white"/>
        <input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} placeholder="Phone" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2.5 text-sm text-white"/>
        <input value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="Email" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2.5 text-sm text-white"/>
        <input value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})} placeholder="Address" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2.5 text-sm text-white"/>
      </div>
      <details className="mt-2 rounded-xl border border-[#2d7dff]/15 bg-black/25 p-2.5"><summary className="cursor-pointer text-xs font-medium text-[#d9fbff]">More details / create service call</summary><div className="mt-3 space-y-2"><textarea value={form.intakeNotes} onChange={(e)=>setForm({...form,intakeNotes:e.target.value})} rows={2} placeholder="Customer notes" className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white"/><label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={form.createServiceCall} onChange={(e)=>setForm({...form,createServiceCall:e.target.checked})}/> Create service call now</label>{form.createServiceCall ? <div className="grid gap-2 sm:grid-cols-2"><select value={form.assignedTechId} onChange={(e)=>setForm({...form,assignedTechId:e.target.value})} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white"><option value="">Unassigned</option>{technicians.map((tech)=><option key={tech.id} value={tech.id}>{tech.fullName}</option>)}</select><input value={form.scheduledWindow} onChange={(e)=>setForm({...form,scheduledWindow:e.target.value})} placeholder="Scheduled window" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white"/><input value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})} placeholder="Job location (optional)" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white sm:col-span-2"/><textarea value={form.scope} onChange={(e)=>setForm({...form,scope:e.target.value})} rows={2} placeholder="Complaint / scope" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white sm:col-span-2"/></div> : null}</div></details>
      <button type="button" disabled={pending || !form.name.trim()} onClick={save} className="mt-2.5 w-full rounded-xl border border-[#8ffafa]/45 bg-[#2d7dff]/15 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{pending ? "Saving..." : form.createServiceCall ? "Save & create service call" : "Save customer"}</button>
    </section> : null}

    <section className="overflow-hidden rounded-2xl border border-[#2d7dff]/25 bg-black/35">
      {filtered.length === 0 ? <div className="p-6 text-center text-sm text-zinc-500">No customers match that search.</div> : filtered.map(({customer, customerEquipment, customerJobs, openJobs}, index) => <details key={customer.id} className={`group ${index ? "border-t border-[#2d7dff]/12" : ""}`}>
        <summary className="flex min-h-[58px] cursor-pointer list-none items-center gap-3 px-3 py-2.5 transition hover:bg-[#2d7dff]/8 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-white">{customer.name}</span>{openJobs.length ? <span className="shrink-0 rounded-full border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">{openJobs.length} OPEN</span> : null}</div><p className="mt-0.5 truncate text-[11px] text-zinc-500">{customer.phone || customer.email || customer.address || "No contact details"}</p></div>
          <div className="hidden shrink-0 text-right text-[10px] text-zinc-500 sm:block">{customerJobs.length} jobs · {customerEquipment.length} assets</div><ChevronDown className="h-4 w-4 shrink-0 text-[#8ffafa]/70 transition group-open:rotate-180"/>
        </summary>
        <div className="border-t border-[#2d7dff]/10 bg-[#07152c]/20 px-3 py-3">
          <div className="mb-2 grid grid-cols-2 gap-2 text-xs text-zinc-400 sm:grid-cols-4"><div><span className="block text-[9px] uppercase tracking-wider text-zinc-600">Phone</span>{customer.phone || "—"}</div><div><span className="block text-[9px] uppercase tracking-wider text-zinc-600">Email</span><span className="break-all">{customer.email || "—"}</span></div><div className="col-span-2"><span className="block text-[9px] uppercase tracking-wider text-zinc-600">Address</span>{customer.address || "—"}</div></div>
          <div className="grid grid-cols-4 gap-1.5"><Link href={`/customers/${customer.id}`} className="rounded-lg border border-[#8ffafa]/25 bg-[#8ffafa]/5 px-2 py-2 text-center text-[10px] font-semibold text-white">Profile</Link><Link href={`/customers/${customer.id}#service-history`} className="rounded-lg border border-[#2d7dff]/20 px-2 py-2 text-center text-[10px] text-[#d9fbff]">Jobs</Link><Link href={`/invoices?customer=${customer.id}`} className="rounded-lg border border-[#2d7dff]/20 px-2 py-2 text-center text-[10px] text-[#d9fbff]">Documents</Link><Link href={`/customers/${customer.id}#equipment`} className="rounded-lg border border-[#2d7dff]/20 px-2 py-2 text-center text-[10px] text-[#d9fbff]">Equipment</Link></div>
        </div>
      </details>)}
    </section>
  </div>;
}
