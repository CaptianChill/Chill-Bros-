"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { submitServiceRequestAction, type ServiceRequestInput } from "@/lib/chillbros/customer-account-actions";

type Location = { id: string; name: string; address: string | null };
type Unit = { id: string; customerId: string; label: string };

const field = "mt-1.5 w-full rounded-xl border border-[#B9CBE3] bg-white px-4 py-3 text-base text-[#0B1220] outline-none placeholder:text-[#8A9AB3] focus:border-[#1F6FEB] focus:ring-2 focus:ring-[#1F6FEB]/25";
const label = "text-sm font-semibold text-[#3D5170]";

const URGENCY: { value: ServiceRequestInput["urgency"]; title: string; sub: string }[] = [
  { value: "routine", title: "Routine", sub: "Whenever works" },
  { value: "soon", title: "Soon", sub: "Next few days" },
  { value: "emergency", title: "Emergency", sub: "It's down now" },
];

export function CustomerRequestForm({ locations, units, initialUnitId }: { locations: Location[]; units: Unit[]; initialUnitId?: string | null }) {
  const router = useRouter();
  const initialUnit = units.find((u) => u.id === initialUnitId) ?? null;
  const [customerId, setCustomerId] = useState(initialUnit?.customerId ?? locations[0]?.id ?? "");
  const [equipmentId, setEquipmentId] = useState(initialUnit?.id ?? "");
  const [problem, setProblem] = useState("");
  const [urgency, setUrgency] = useState<ServiceRequestInput["urgency"]>("routine");
  const [preferredTime, setPreferredTime] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const locationUnits = useMemo(() => units.filter((u) => u.customerId === customerId), [units, customerId]);

  const submit = () => {
    if (problem.trim().length < 5) { setError("Tell us what's going on."); return; }
    setError(null);
    startTransition(async () => {
      const result = await submitServiceRequestAction({ customerId, equipmentId: equipmentId || null, problem, urgency, preferredTime, contactName, contactPhone });
      if (!result.ok) { setError(result.error); return; }
      router.replace(`/my?requested=${encodeURIComponent(result.data.jobNumber ?? "1")}`);
      router.refresh();
    });
  };

  return (
    <form className="space-y-5" noValidate onSubmit={(e) => { e.preventDefault(); if (!pending) submit(); }}>
      {locations.length > 1 ? (
        <label className="block"><span className={label}>Location</span>
          <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setEquipmentId(""); }} className={field}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.address ? ` · ${l.address}` : ""}</option>)}
          </select>
        </label>
      ) : null}

      {locationUnits.length ? (
        <label className="block"><span className={label}>Which unit? <span className="font-normal">(optional)</span></span>
          <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className={field}>
            <option value="">Not sure / something else</option>
            {locationUnits.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </label>
      ) : null}

      <label className="block"><span className={label}>What&apos;s going on?</span>
        <textarea value={problem} onChange={(e) => { setProblem(e.target.value); setError(null); }} rows={4} maxLength={2000} placeholder="Walk-in cooler is at 48°F and the fan is making a grinding noise." className={`${field} resize-y`} />
      </label>

      <fieldset>
        <legend className={label}>How urgent?</legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {URGENCY.map((u) => {
            const active = urgency === u.value;
            const danger = u.value === "emergency";
            return (
              <button key={u.value} type="button" aria-pressed={active} onClick={() => setUrgency(u.value)}
                className={`rounded-xl border px-2 py-2.5 text-center transition ${active ? (danger ? "border-[#B42318] bg-[#FDECEA] text-[#8C1D18]" : "border-[#1F6FEB] bg-[#EAF3FF] text-[#1452C2]") : "border-[#B9CBE3] bg-white text-[#0B1220]"}`}>
                <span className="block text-[15px] font-bold">{u.title}</span>
                <span className="block text-xs">{u.sub}</span>
              </button>
            );
          })}
        </div>
        {urgency === "emergency" ? <p className="mt-2 text-sm font-semibold text-[#8C1D18]">For emergencies, also call or text us so we can respond right away.</p> : null}
      </fieldset>

      <label className="block"><span className={label}>Best day and time for a visit <span className="font-normal">(optional)</span></span>
        <input value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} maxLength={200} placeholder="Weekday mornings before 11 AM" className={field} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className={label}>On-site contact <span className="font-normal">(optional)</span></span>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={120} autoComplete="name" placeholder="Name" className={field} />
        </label>
        <label className="block"><span className={label}>Contact phone <span className="font-normal">(optional)</span></span>
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} maxLength={50} type="tel" inputMode="tel" autoComplete="tel" placeholder="(210) 555-0123" className={field} />
        </label>
      </div>

      {error ? <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p> : null}
      <button type="submit" disabled={pending} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#1F6FEB] text-lg font-bold text-white shadow-[0_4px_14px_rgba(31,111,235,0.35)] hover:bg-[#1a5fd0] disabled:opacity-60">
        <Send className="h-5 w-5" aria-hidden="true" />{pending ? "Sending…" : "Send request"}
      </button>
      <p className="text-center text-sm text-[#3D5170]">We&apos;ll review it and contact you to confirm a time.</p>
    </form>
  );
}
