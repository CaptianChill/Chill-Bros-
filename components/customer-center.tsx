"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Boxes, CalendarPlus, CheckCircle2, RefreshCw, RotateCcw, Search, UserPlus, UserRoundSearch, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";

import { createCustomerIntakeAction } from "@/lib/chillbros/customer-intake";
import type { EquipmentRecord } from "@/lib/chillbros/equipment-queries";
import type { ActiveTechnician, DispatchJob } from "@/lib/chillbros/operations-queries";
import type { Customer } from "@/lib/chillbros/types";

const emptyIntake = () => ({
  name: "",
  phone: "",
  email: "",
  address: "",
  intakeNotes: "",
  createServiceCall: true,
  assignedTechId: "",
  location: "",
  scheduledWindow: "",
  scope: "",
});

export function CustomerCenter({ customers, technicians, equipment, jobs }: { customers: Customer[]; technicians: ActiveTechnician[]; equipment: EquipmentRecord[]; jobs: DispatchJob[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(emptyIntake());
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const summaries = useMemo(() => customers.map((customer) => {
    const customerEquipment = equipment.filter((item) => item.customerId === customer.id);
    const customerJobs = jobs.filter((job) => job.customerId === customer.id);
    const openJobs = customerJobs.filter((job) => ["scheduled", "in_progress"].includes(job.status));
    const activeTechs = Array.from(new Set(openJobs.map((job) => job.assignedTechName).filter(Boolean))) as string[];
    const searchableEquipment = customerEquipment.map((item) => [item.assetTag, item.equipmentType, item.manufacturer, item.model, item.serialNumber, item.refrigerant].filter(Boolean).join(" ")).join(" ");
    const haystack = [customer.name, customer.phone, customer.email, customer.address, ...activeTechs, searchableEquipment].filter(Boolean).join(" ").toLowerCase();
    return { customer, customerEquipment, customerJobs, openJobs, activeTechs, haystack };
  }), [customers, equipment, jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((item) => item.haystack.includes(q));
  }, [query, summaries]);

  const clearForm = () => {
    setForm(emptyIntake());
    setError(null);
    setMessage(null);
  };

  const refresh = () => {
    setError(null);
    setMessage(null);
    router.refresh();
  };

  const saveCustomer = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createCustomerIntakeAction({
        ...form,
        assignedTechId: form.assignedTechId || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const dispatched = Boolean(result.data.jobId);
      setForm(emptyIntake());
      setMessage(dispatched ? "Customer saved and initial service call dispatched. Intake form cleared for the next customer." : "Customer saved. Intake form cleared for the next customer.");
      router.refresh();
    });
  };

  return <div className="space-y-6">
    {error ? <p className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
    {message ? <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}

    <section className="rounded-3xl border border-[#2d7dff]/30 bg-black/35 p-4 shadow-[0_0_22px_rgba(45,125,255,0.08)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#2d7dff]/15 pb-4">
        <div>
          <div className="flex items-center gap-2 text-white"><UserPlus className="h-5 w-5 text-[#8ffafa]" /><h2 className="text-xl font-semibold">New customer intake</h2></div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Enter the customer once. Add an initial service call and technician assignment at the same time, or save the customer by itself for future work.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={clearForm} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff] disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />Clear</button>
          <button type="button" onClick={refresh} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff] disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5"><span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Customer / business name *</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Customer or company name" autoComplete="organization" className="w-full rounded-2xl border border-[#2d7dff]/20 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-[#8ffafa]/50" /></label>
        <label className="space-y-1.5"><span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Phone</span><input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="210-555-0123" autoComplete="tel" className="w-full rounded-2xl border border-[#2d7dff]/20 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-[#8ffafa]/50" /></label>
        <label className="space-y-1.5"><span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="customer@email.com" autoComplete="email" className="w-full rounded-2xl border border-[#2d7dff]/20 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-[#8ffafa]/50" /></label>
        <label className="space-y-1.5"><span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Service / billing address</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Street, city, state, ZIP" autoComplete="street-address" className="w-full rounded-2xl border border-[#2d7dff]/20 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-[#8ffafa]/50" /></label>
      </div>
      <label className="mt-3 block space-y-1.5"><span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Customer intake notes</span><textarea value={form.intakeNotes} onChange={(event) => setForm({ ...form, intakeNotes: event.target.value })} rows={3} placeholder="Access instructions, primary contact, billing notes, site details, or other customer information..." className="w-full rounded-2xl border border-[#2d7dff]/20 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-[#8ffafa]/50" /></label>

      <div className="mt-5 rounded-2xl border border-[#2d7dff]/20 bg-[#07152c]/35 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={form.createServiceCall} onChange={(event) => setForm({ ...form, createServiceCall: event.target.checked })} className="mt-1 h-4 w-4" />
          <span><span className="flex items-center gap-2 font-medium text-white"><CalendarPlus className="h-4 w-4 text-[#8ffafa]" />Create an initial service call now</span><span className="mt-1 block text-xs leading-5 text-zinc-400">Keep this checked when the customer is calling for service today. Uncheck it when you only want to add the customer to the database.</span></span>
        </label>

        {form.createServiceCall ? <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5"><span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Assign technician</span><select value={form.assignedTechId} onChange={(event) => setForm({ ...form, assignedTechId: event.target.value })} className="w-full rounded-2xl border border-[#2d7dff]/20 bg-zinc-950 px-4 py-3 text-white outline-none"><option value="">Unassigned / assign later</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}</option>)}</select></label>
          <label className="space-y-1.5"><span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Scheduled window</span><input value={form.scheduledWindow} onChange={(event) => setForm({ ...form, scheduledWindow: event.target.value })} placeholder="Sep 4 • 1-3 PM" className="w-full rounded-2xl border border-[#2d7dff]/20 bg-zinc-950 px-4 py-3 text-white outline-none" /></label>
          <label className="space-y-1.5 md:col-span-2"><span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Job location</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Leave blank to use the customer address" className="w-full rounded-2xl border border-[#2d7dff]/20 bg-zinc-950 px-4 py-3 text-white outline-none" /></label>
          <label className="space-y-1.5 md:col-span-2"><span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Complaint / dispatch scope</span><textarea value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} rows={3} placeholder="What is happening, equipment affected, access notes, urgency..." className="w-full rounded-2xl border border-[#2d7dff]/20 bg-zinc-950 px-4 py-3 text-white outline-none" /></label>
        </div> : null}
      </div>

      <button type="button" onClick={saveCustomer} disabled={pending || !form.name.trim()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/45 bg-[#2d7dff]/15 px-5 py-3.5 font-semibold text-white shadow-[0_0_18px_rgba(45,125,255,0.12)] transition hover:bg-[#2d7dff]/25 disabled:opacity-45"><CheckCircle2 className="h-5 w-5" />{pending ? "Saving customer..." : form.createServiceCall ? "Save customer & create service call" : "Save customer"}</button>
      <p className="mt-2 text-center text-xs text-zinc-500">Successful saves automatically clear every intake field and refresh the customer database.</p>
    </section>

    <section className="rounded-3xl border border-[#2d7dff]/30 bg-black/35 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2 text-white"><UserRoundSearch className="h-5 w-5 text-[#8ffafa]" /><h2 className="text-xl font-semibold">Customer database</h2></div><p className="mt-2 text-sm text-zinc-400">Search customer information, equipment, asset tags, serial/model data, or assigned technician. Tap a customer to open the complete record.</p></div>
        <span className="rounded-full border border-[#8ffafa]/25 bg-[#8ffafa]/5 px-3 py-1.5 text-xs font-semibold text-[#d9fbff]">{filtered.length} of {customers.length}</span>
      </div>

      <div className="relative mt-4"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, email, address, equipment, serial, tech..." className="w-full rounded-2xl border border-[#2d7dff]/25 bg-zinc-950 py-3 pl-11 pr-4 text-white outline-none focus:border-[#8ffafa]/50" /></div>

      {filtered.length === 0 ? <div className="mt-4 rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/60 p-5 text-center text-sm text-zinc-500">No customers match that search.</div> : <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {filtered.map(({ customer, customerEquipment, customerJobs, openJobs, activeTechs }) => <article key={customer.id} className="min-w-0 rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/65 p-4 transition hover:border-[#8ffafa]/35">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><Link href={`/customers/${customer.id}`} className="text-lg font-semibold text-white underline decoration-[#2d7dff]/40 underline-offset-4 hover:text-[#d9fbff]">{customer.name}</Link><p className="mt-1 break-words text-xs leading-5 text-zinc-500">{customer.address || "No address recorded"}</p></div>
            <Link href={`/customers/${customer.id}`} aria-label={`Open ${customer.name}`} className="shrink-0 rounded-xl border border-[#2d7dff]/25 p-2 text-[#8ffafa]"><UserRoundSearch className="h-4 w-4" /></Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl border border-[#2d7dff]/10 bg-black/35 p-2"><Boxes className="mb-1 h-3.5 w-3.5 text-[#8ffafa]" /><p className="font-semibold text-white">{customerEquipment.length}</p><p className="text-zinc-500">equipment</p></div>
            <div className="rounded-xl border border-[#2d7dff]/10 bg-black/35 p-2"><Wrench className="mb-1 h-3.5 w-3.5 text-[#8ffafa]" /><p className="font-semibold text-white">{openJobs.length}</p><p className="text-zinc-500">open calls</p></div>
            <div className="rounded-xl border border-[#2d7dff]/10 bg-black/35 p-2"><CalendarPlus className="mb-1 h-3.5 w-3.5 text-[#8ffafa]" /><p className="font-semibold text-white">{customerJobs.length}</p><p className="text-zinc-500">call records</p></div>
            <div className="rounded-xl border border-[#2d7dff]/10 bg-black/35 p-2"><UserRoundSearch className="mb-1 h-3.5 w-3.5 text-[#8ffafa]" /><p className="truncate font-semibold text-white">{activeTechs[0] ?? "None"}</p><p className="text-zinc-500">assigned tech</p></div>
          </div>
          <div className="mt-3 space-y-1 text-sm text-zinc-300">{customer.phone ? <p><span className="text-zinc-500">Phone:</span> {customer.phone}</p> : null}{customer.email ? <p className="break-all"><span className="text-zinc-500">Email:</span> {customer.email}</p> : null}</div>
          {customerEquipment.length ? <div className="mt-3 flex flex-wrap gap-1.5">{customerEquipment.slice(0, 3).map((item) => <span key={item.id} className="rounded-full border border-[#2d7dff]/20 bg-[#2d7dff]/5 px-2.5 py-1 text-[10px] text-[#d9fbff]">{item.assetTag || item.equipmentType}{item.manufacturer ? ` • ${item.manufacturer}` : ""}</span>)}{customerEquipment.length > 3 ? <span className="rounded-full border border-[#2d7dff]/15 px-2.5 py-1 text-[10px] text-zinc-500">+{customerEquipment.length - 3} more</span> : null}</div> : null}
          <Link href={`/customers/${customer.id}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 bg-[#2d7dff]/5 px-3 py-2.5 text-sm font-medium text-[#d9fbff]"><UserRoundSearch className="h-4 w-4" />Open full customer profile</Link>
        </article>)}
      </div>}
    </section>
  </div>;
}
