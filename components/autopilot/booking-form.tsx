"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarCheck, CheckCircle2 } from "lucide-react";

import { bookServiceAction, type BookingInput } from "@/lib/chillbros/autopilot/booking-actions";

export type SlotOption = { date: string; dayLabel: string; window: string; timeLabel: string };

const field = "mt-1.5 w-full rounded-xl border border-[#B9CBE3] bg-white px-4 py-3 text-base text-[#0B1220] outline-none placeholder:text-[#8A9AB3] focus:border-[#1F6FEB] focus:ring-2 focus:ring-[#1F6FEB]/25";
const label = "text-sm font-semibold text-[#3D5170]";

const SERVICES: { value: string; label: string }[] = [
  { value: "hvac_r", label: "Heating & AC" },
  { value: "refrigeration", label: "Walk-in / refrigeration" },
  { value: "ice_machine", label: "Ice machine" },
  { value: "kitchen_equipment", label: "Kitchen equipment" },
  { value: "exhaust_hood", label: "Vent hood cleaning" },
  { value: "maintenance", label: "Maintenance / tune-up" },
  { value: "other", label: "Something else" },
];

export function BookingForm({ slots, prefill, refParam, feeNote, hoodActive }: {
  slots: SlotOption[];
  prefill: { name?: string; email?: string; phone?: string; address?: string; problem?: string; propertyType?: "residential" | "commercial" };
  refParam: BookingInput["ref"];
  feeNote: string | null;
  hoodActive: boolean;
}) {
  const days = useMemo(() => {
    const map = new Map<string, { date: string; dayLabel: string; slots: SlotOption[] }>();
    for (const s of slots) {
      const d = map.get(s.date) ?? { date: s.date, dayLabel: s.dayLabel, slots: [] };
      d.slots.push(s);
      map.set(s.date, d);
    }
    return [...map.values()];
  }, [slots]);

  const [day, setDay] = useState(days[0]?.date ?? "");
  const [picked, setPicked] = useState("");
  const [propertyType, setPropertyType] = useState<"residential" | "commercial">(prefill.propertyType ?? "residential");
  const [serviceLine, setServiceLine] = useState("hvac_r");
  const [name, setName] = useState(prefill.name ?? "");
  const [phone, setPhone] = useState(prefill.phone ?? "");
  const [email, setEmail] = useState(prefill.email ?? "");
  const [address, setAddress] = useState(prefill.address ?? "");
  const [problem, setProblem] = useState(prefill.problem ?? "");
  const [website, setWebsite] = useState("");
  // A signed-in customer's details are already known: show them compactly instead of a form.
  const knownContact = Boolean(prefill.name && prefill.phone && prefill.address);
  const [editContact, setEditContact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ window: string; jobNumber: string | null } | null>(null);
  const [pending, startTransition] = useTransition();

  const services = SERVICES.filter((s) => hoodActive || s.value !== "exhaust_hood");
  const daySlots = days.find((d) => d.date === day)?.slots ?? [];

  if (done) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-[#1F8A4C]" aria-hidden="true" />
        <h2 className="mt-3 text-2xl font-bold">You&apos;re booked</h2>
        <p className="mt-2 text-[17px] text-[#0B1220]">{done.window}</p>
        {done.jobNumber ? <p className="mt-1 text-sm text-[#3D5170]">Confirmation {done.jobNumber}</p> : null}
        <p className="mt-4 text-[15px] text-[#3D5170]">A Chill Pros technician will call if anything changes. {email ? "A confirmation is on its way to your email." : ""}</p>
      </div>
    );
  }

  if (!days.length) {
    return <p className="text-[15px] text-[#3D5170]">We&apos;re fully booked for the next few days. Call or text us and we&apos;ll fit you in as soon as possible.</p>;
  }

  const submit = () => {
    if (!picked) { setError("Pick a time."); return; }
    setError(null);
    startTransition(async () => {
      const result = await bookServiceAction({ window: picked, name, phone, email, address, propertyType, serviceLine, problem, ref: refParam, website });
      if (!result.ok) { setError(result.error); return; }
      setDone({ window: result.data.window, jobNumber: result.data.jobNumber });
    });
  };

  return (
    <form className="space-y-5" noValidate onSubmit={(e) => { e.preventDefault(); if (!pending) submit(); }}>
      <fieldset>
        <legend className={label}>1. Pick a day</legend>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <button key={d.date} type="button" aria-pressed={day === d.date} onClick={() => { setDay(d.date); setPicked(""); }}
              className={`shrink-0 rounded-xl border px-3 py-2 text-center ${day === d.date ? "border-[#1F6FEB] bg-[#EAF3FF] text-[#1452C2]" : "border-[#B9CBE3] bg-white"}`}>
              <span className="block text-[15px] font-bold">{d.dayLabel}</span>
              <span className="block text-xs">{d.slots.length} open</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>2. Pick a time</legend>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {daySlots.map((s) => (
            <button key={s.window} type="button" aria-pressed={picked === s.window} onClick={() => { setPicked(s.window); setError(null); }}
              className={`rounded-xl border px-1 py-3 text-[15px] font-semibold ${picked === s.window ? "border-[#1F6FEB] bg-[#1F6FEB] text-white" : "border-[#B9CBE3] bg-white text-[#0B1220]"}`}>
              {s.timeLabel}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[#3D5170]">Arrival window. The technician calls when on the way.</p>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className={label}>3. Tell us about the job</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["residential", "commercial"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={propertyType === t} onClick={() => setPropertyType(t)}
              className={`rounded-xl border py-2.5 text-[15px] font-bold capitalize ${propertyType === t ? "border-[#1F6FEB] bg-[#EAF3FF] text-[#1452C2]" : "border-[#B9CBE3] bg-white"}`}>{t === "residential" ? "Home" : "Business"}</button>
          ))}
        </div>
        <label className="block"><span className={label}>Service</span>
          <select value={serviceLine} onChange={(e) => setServiceLine(e.target.value)} className={field}>
            {services.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="block"><span className={label}>What&apos;s going on?</span>
          <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={3} maxLength={2000} placeholder="AC is running but blowing warm air." className={`${field} resize-y`} />
        </label>
        {knownContact && !editContact ? (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-[#B9CBE3] bg-[#F7FAFE] px-4 py-3">
            <p className="min-w-0 text-[15px] text-[#0B1220]"><span className="block font-semibold">{name}</span><span className="block truncate text-[#3D5170]">{phone}{email ? ` · ${email}` : ""}</span><span className="block truncate text-[#3D5170]">{address}</span></p>
            <button type="button" onClick={() => setEditContact(true)} className="shrink-0 text-sm font-semibold text-[#1F6FEB]">Change</button>
          </div>
        ) : <>
        <label className="block"><span className={label}>{propertyType === "commercial" ? "Business name and contact" : "Your name"}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoComplete="name" className={field} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={label}>Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="(210) 555-0123" className={field} />
          </label>
          <label className="block"><span className={label}>Email <span className="font-normal">(optional)</span></span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" className={field} />
          </label>
        </div>
        <label className="block"><span className={label}>Service address</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} autoComplete="street-address" placeholder="Street, city" className={field} />
        </label>
        </>}
        <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" />
      </fieldset>

      {feeNote ? <p className="rounded-xl bg-[#EAF3FF] px-4 py-3 text-sm text-[#1F3B63]">{feeNote}</p> : null}
      {error ? <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p> : null}
      <button type="submit" disabled={pending} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#1F6FEB] text-lg font-bold text-white shadow-[0_4px_14px_rgba(31,111,235,0.35)] hover:bg-[#1a5fd0] disabled:opacity-60">
        <CalendarCheck className="h-5 w-5" aria-hidden="true" />{pending ? "Booking…" : "Book this time"}
      </button>
    </form>
  );
}
