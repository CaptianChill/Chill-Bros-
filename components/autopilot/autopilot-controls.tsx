"use client";

import { useState, useTransition } from "react";

import { setAutopilotCapsAction, setAutopilotSwitchAction, type AutopilotSwitch } from "@/lib/chillbros/autopilot/settings-actions";

const LABELS: { key: AutopilotSwitch; title: string; sub: string }[] = [
  { key: "enabled", title: "Autopilot", sub: "Master switch for everything below" },
  { key: "inbound_enabled", title: "Instant replies", sub: "Answer new leads within seconds, plus follow-ups" },
  { key: "reactivation_enabled", title: "Customer check-ins", sub: "Past customers, Tue–Thu mornings" },
  { key: "cold_email_enabled", title: "Cold email", sub: "New businesses, best-time windows" },
  { key: "reply_enabled", title: "Answer replies", sub: "Claude answers replies to our emails, 7am–9pm; hot leads ping your phone" },
  { key: "hood_cleaning_active", title: "Sell hood cleaning", sub: "Offer vent hood cleaning in messages and booking" },
];

export function AutopilotControls({ initial, caps }: { initial: Record<AutopilotSwitch, boolean>; caps: { cold: number; reactivation: number } }) {
  const [values, setValues] = useState(initial);
  const [cold, setCold] = useState(String(caps.cold));
  const [react, setReact] = useState(String(caps.reactivation));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (key: AutopilotSwitch) => {
    const next = !values[key];
    setValues((v) => ({ ...v, [key]: next }));
    start(async () => {
      const r = await setAutopilotSwitchAction(key, next);
      if (!r.ok) { setValues((v) => ({ ...v, [key]: !next })); setMsg(r.error ?? "Could not save."); } else setMsg(null);
    });
  };

  return (
    <div className="space-y-3 text-left">
      {LABELS.map((l) => {
        const on = values[l.key];
        const muted = l.key !== "enabled" && !values.enabled;
        return (
          <button key={l.key} type="button" disabled={pending} onClick={() => toggle(l.key)} aria-pressed={on}
            className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${on ? "border-emerald-400/40 bg-emerald-400/10" : "border-zinc-600/40 bg-black/40"} ${muted ? "opacity-50" : ""}`}>
            <span><span className="block font-semibold text-white">{l.title}</span><span className="block text-xs text-zinc-400">{l.sub}</span></span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-emerald-400 text-black" : "bg-zinc-700 text-zinc-200"}`}>{on ? "ON" : "OFF"}</span>
          </button>
        );
      })}
      <form className="grid grid-cols-2 gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await setAutopilotCapsAction({ coldDailyCap: Number(cold), reactivationDailyCap: Number(react) }); setMsg(r.ok ? "Daily limits saved." : r.error ?? "Could not save."); }); }}>
        <label className="text-xs text-zinc-400">Cold emails / day
          <input value={cold} onChange={(e) => setCold(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-zinc-600 bg-black/50 px-3 py-2 text-base text-white" />
        </label>
        <label className="text-xs text-zinc-400">Check-ins / day
          <input value={react} onChange={(e) => setReact(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-zinc-600 bg-black/50 px-3 py-2 text-base text-white" />
        </label>
        <button type="submit" disabled={pending} className="col-span-2 rounded-lg border border-[#2d7dff]/50 bg-[#2d7dff]/15 py-2 text-sm font-semibold text-white">Save daily limits</button>
      </form>
      {msg ? <p className="text-sm text-amber-200">{msg}</p> : null}
    </div>
  );
}
