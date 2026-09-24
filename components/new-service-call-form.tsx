"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";

import { createEquipmentLinkedJobAction } from "@/lib/chillbros/equipment-job-intake";
import { createCustomerAction } from "@/lib/chillbros/operations";
import { displayTime } from "@/lib/chillbros/schedule-window";

type CustomerOption = { id: string; name: string; address: string | null };
type UnitOption = { id: string; customerId: string; label: string };
type TechOption = { id: string; fullName: string };

const TIMES = Array.from({ length: 29 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const field = "mt-1 min-h-11 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 text-base font-medium text-[#0A1A33] placeholder:text-[#5B6B82]";
const labelClass = "block text-sm font-semibold text-[#0A1A33]";

// New service call in one screen: customer (or a new one), unit, complaint,
// technician and time. Uses the existing equipment-linked intake action, then
// opens the new job so parts can be added right away.
export function NewServiceCallForm({ customers, units, technicians, today, initialCustomerId }: { customers: CustomerOption[]; units: UnitOption[]; technicians: TechOption[]; today: string; initialCustomerId?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [newCustomer, setNewCustomer] = useState(false);
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [equipmentId, setEquipmentId] = useState("");
  const [location, setLocation] = useState("");
  const [scope, setScope] = useState("");
  const [approved, setApproved] = useState(false);
  const [techId, setTechId] = useState("");
  const [scheduleNow, setScheduleNow] = useState(true);
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");

  const customerUnits = useMemo(() => units.filter((unit) => unit.customerId === customerId), [units, customerId]);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!newCustomer && !customerId) return setError("Choose a customer.");
    if (newCustomer && !customer.name.trim()) return setError("Enter the new customer's name.");
    if (!scope.trim()) return setError("Describe the complaint or the repair to do.");
    if (scheduleNow && (!date || end <= start)) return setError("Choose a date and an end time after the start time.");

    startTransition(async () => {
      let id = customerId;
      if (newCustomer) {
        const created = await createCustomerAction({ name: customer.name, phone: customer.phone, email: customer.email, address: customer.address });
        if (!created.ok) return setError(created.error);
        id = created.data.customerId;
      }
      const fullScope = approved ? `${scope.trim()}\nRepair approved verbally by customer.` : scope.trim();
      const result = await createEquipmentLinkedJobAction({
        customerId: id,
        equipmentId: newCustomer ? null : equipmentId || null,
        assignedTechId: techId || null,
        location: location.trim() || (newCustomer ? customer.address : ""),
        scope: fullScope,
        scheduledWindow: scheduleNow ? `${date} ${start}-${end} CT` : undefined,
      });
      if (!result.ok) return setError(result.error);
      router.push(`/jobs/${result.jobId}?success=${encodeURIComponent("Service call created. Add parts below.")}#parts`);
    });
  };

  return (
    <form onSubmit={submit} className="cb-new space-y-3.5" data-no-draft>
      <section className="cb-card space-y-3 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[26px] leading-none">Customer</h2>
          <button type="button" onClick={() => setNewCustomer((value) => !value)} className="min-h-11 px-1 text-sm font-semibold text-[#1557B0]">
            {newCustomer ? "Pick existing" : "+ New customer"}
          </button>
        </div>
        {newCustomer ? (
          <div className="grid gap-2">
            <label className={labelClass}>Name<input required value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className={field} /></label>
            <label className={labelClass}>Phone<input type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className={field} /></label>
            <label className={labelClass}>Email<input type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className={field} /></label>
            <label className={labelClass}>Address<input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} className={field} /></label>
          </div>
        ) : (
          <>
            <label className={labelClass}>
              Customer
              <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setEquipmentId(""); }} className={field}>
                <option value="">Choose customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {customerId ? (
              <label className={labelClass}>
                Unit (optional)
                <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className={field}>
                  <option value="">{customerUnits.length ? "No specific unit" : "No saved units for this customer"}</option>
                  {customerUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
                </select>
              </label>
            ) : null}
          </>
        )}
        <label className={labelClass}>
          Service address
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={selectedCustomer?.address ? `Uses ${selectedCustomer.address}` : "Uses the customer's address"} className={field} />
        </label>
      </section>

      <section className="cb-card space-y-3 p-3.5">
        <h2 className="text-[26px] leading-none">The work</h2>
        <label className={labelClass}>
          Complaint or repair to do
          <textarea required rows={4} value={scope} onChange={(e) => setScope(e.target.value)} placeholder="e.g. Replace condenser fan motor and capacitor" className={`${field} py-2`} />
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 text-base font-semibold text-[#0A1A33]">
          <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="h-5 w-5 accent-[#1557B0]" />
          Customer approved this repair verbally
        </label>
      </section>

      <section className="cb-card space-y-3 p-3.5">
        <h2 className="text-[26px] leading-none">Schedule</h2>
        <label className={labelClass}>
          Technician
          <select value={techId} onChange={(e) => setTechId(e.target.value)} className={field}>
            <option value="">Unassigned (assign later)</option>
            {technicians.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="When">
          {[true, false].map((value) => (
            <button key={String(value)} type="button" role="radio" aria-checked={scheduleNow === value} onClick={() => setScheduleNow(value)} className={`min-h-11 rounded-xl border font-semibold ${scheduleNow === value ? "border-[#1557B0] bg-[#1557B0] text-white" : "border-[#C7D3E2] bg-[#F8FAFD] text-[#0A1A33]"}`}>
              {value ? "Schedule now" : "Schedule later"}
            </button>
          ))}
        </div>
        {scheduleNow ? (
          <div className="grid grid-cols-2 gap-2">
            <label className={`${labelClass} col-span-2`}>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></label>
            <label className={labelClass}>Start<select value={start} onChange={(e) => setStart(e.target.value)} className={field}>{TIMES.map((t) => <option key={t} value={t}>{displayTime(t)}</option>)}</select></label>
            <label className={labelClass}>End<select value={end} onChange={(e) => setEnd(e.target.value)} className={field}>{TIMES.map((t) => <option key={t} value={t}>{displayTime(t)}</option>)}</select></label>
          </div>
        ) : null}
      </section>

      {error ? <p role="alert" className="cb-card p-3 text-sm font-semibold text-[#0B5CD5]">{error}</p> : null}
      <button type="submit" disabled={pending} className="flex h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-[#1557B0] text-lg font-bold text-white shadow-[0_2px_8px_rgba(10,26,51,0.25)] transition hover:bg-[#0E3F82] disabled:opacity-60">
        {pending ? "Creating…" : "Create call & add parts"}
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </form>
  );
}
