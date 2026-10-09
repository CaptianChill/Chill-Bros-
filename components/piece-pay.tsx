"use client";

import { Check, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { markPiecePayPaidAction, removePiecePayAction, savePiecePayAction, saveStaffPaySettingAction } from "@/lib/chillbros/piece-pay-actions";
import type { PieceJob, SavedPiecePay, StaffPaySetting } from "@/lib/chillbros/piece-pay";

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const field = "rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white";
const round25 = (value: number) => Math.round(value / 25) * 25;

function Feedback({ error, message }: { error: string | null; message: string | null }) {
  if (error) return <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>;
  if (message) return <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p>;
  return null;
}

/** Hourly or piece pay, and the piece rate, for each staff member. */
export function StaffPaySettings({ staff }: { staff: StaffPaySetting[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(() => staff.map((s) => ({ ...s, ratePercent: String(Math.round(s.pieceRate * 1000) / 10) })));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const save = (index: number) => {
    const row = rows[index]; setError(null); setMessage(null);
    start(async () => {
      const result = await saveStaffPaySettingAction(row.profileId, row.payType, Number(row.ratePercent));
      if (!result.ok) { setError(result.error); return; }
      setMessage(`${row.fullName}: ${row.payType === "piece" ? `piece pay at ${row.ratePercent}%` : "hourly"}.`);
      router.refresh();
    });
  };
  return <div className="space-y-2">
    <Feedback error={error} message={message} />
    {rows.map((row, index) => <div key={row.profileId} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-[#2d7dff]/15 bg-black/40 p-3 sm:grid-cols-[1fr_140px_110px_auto]">
      <p className="font-medium text-white">{row.fullName}</p>
      <select aria-label={`${row.fullName} pay type`} value={row.payType} onChange={(e) => setRows((cur) => cur.map((r, i) => i === index ? { ...r, payType: e.target.value as "hourly" | "piece" } : r))} className={field}><option value="piece">Piece pay</option><option value="hourly">Hourly</option></select>
      <label className={`flex items-center gap-1 text-sm text-zinc-300 ${row.payType === "piece" ? "" : "opacity-40"}`}><input aria-label={`${row.fullName} piece rate`} type="number" inputMode="decimal" min="0" max="100" step="0.5" value={row.ratePercent} disabled={row.payType !== "piece"} onChange={(e) => setRows((cur) => cur.map((r, i) => i === index ? { ...r, ratePercent: e.target.value } : r))} className={`${field} w-20`} />%</label>
      <button type="button" disabled={pending} onClick={() => save(index)} className="rounded-xl border border-[#8ffafa]/40 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Save</button>
    </div>)}
  </div>;
}

/** The job pay calculator — same math as the owner's spreadsheet. */
export function PiecePayCalculator({ job, staff, defaultOpen = false }: { job: PieceJob; staff: StaffPaySetting[]; defaultOpen?: boolean }) {
  const router = useRouter();
  const pieceStaff = staff.filter((s) => s.payType === "piece");
  const firstSaved = job.saved[0];
  const defaultTech = firstSaved?.technicianId ?? (pieceStaff.find((s) => s.profileId === job.assignedTechId) ?? pieceStaff[0] ?? staff.find((s) => s.profileId === job.assignedTechId) ?? staff[0])?.profileId ?? "";
  const [techId, setTechId] = useState(defaultTech);
  const savedFor = job.saved.find((s) => s.technicianId === techId);
  const tech = staff.find((s) => s.profileId === techId);
  const initialCosts = (saved?: SavedPiecePay) => Object.fromEntries(job.lines.map((line) => [line.key, String(saved?.lineCosts.find((c) => c.key === line.key)?.cost ?? line.suggestedCost)]));
  const [costs, setCosts] = useState<Record<string, string>>(() => initialCosts(savedFor));
  const [ratePercent, setRatePercent] = useState(String(savedFor ? Math.round(savedFor.rate * 1000) / 10 : Math.round((tech?.pieceRate ?? 0.25) * 1000) / 10));
  const [callback, setCallback] = useState(savedFor?.isCallback ?? false);
  const [notes, setNotes] = useState(savedFor?.notes ?? "");
  const [payOverride, setPayOverride] = useState<string>(savedFor ? String(savedFor.payAmount) : "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const math = useMemo(() => {
    const revenue = job.lines.reduce((s, l) => s + l.customerPays, 0) + job.adjustments.reduce((s, a) => s + a.amount, 0);
    const cost = job.lines.reduce((s, l) => s + (Number(costs[l.key]) || 0), 0);
    const kept = revenue - cost;
    const exact = callback ? 0 : Math.max(0, kept) * (Number(ratePercent) || 0) / 100;
    return { revenue, cost, kept, exact, recommended: callback ? 0 : round25(exact) };
  }, [job, costs, ratePercent, callback]);
  const finalPay = payOverride === "" ? math.recommended : Number(payOverride) || 0;
  const locked = savedFor?.status === "paid";

  const changeTech = (id: string) => {
    setTechId(id);
    const saved = job.saved.find((s) => s.technicianId === id);
    const next = staff.find((s) => s.profileId === id);
    setCosts(initialCosts(saved));
    setRatePercent(String(saved ? Math.round(saved.rate * 1000) / 10 : Math.round((next?.pieceRate ?? 0.25) * 1000) / 10));
    setCallback(saved?.isCallback ?? false); setNotes(saved?.notes ?? ""); setPayOverride(saved ? String(saved.payAmount) : "");
  };
  const save = () => {
    setError(null); setMessage(null);
    start(async () => {
      const result = await savePiecePayAction({ invoiceId: job.invoiceId, technicianId: techId, lineCosts: job.lines.map((l) => ({ key: l.key, label: l.label, cost: Number(costs[l.key]) || 0 })), ratePercent: Number(ratePercent), payAmount: finalPay, isCallback: callback, notes });
      if (!result.ok) { setError(result.error); return; }
      setMessage(`Approved: ${tech?.fullName ?? "Technician"} gets ${money(result.data.payAmount)} for ${job.invoiceNumber}.`);
      router.refresh();
    });
  };
  const remove = () => {
    if (!savedFor) return;
    setError(null); setMessage(null);
    start(async () => { const result = await removePiecePayAction(savedFor.id); if (!result.ok) setError(result.error); else { setMessage("Removed."); router.refresh(); } });
  };

  return <details open={defaultOpen} className="group rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/75 p-4">
    <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{job.invoiceNumber}{job.paymentStatus === "paid" ? " · customer paid" : " · customer not paid yet"}</p><p className="mt-1 truncate font-semibold text-white">{job.customerName}</p>{job.jobScope ? <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">{job.jobScope}</p> : null}</div>
      <div className="shrink-0 text-right">{job.saved.length ? job.saved.map((s) => <p key={s.id} className={`text-sm font-semibold ${s.status === "paid" ? "text-emerald-300" : "text-amber-200"}`}>{s.technicianName.split(" ")[0]} {money(s.payAmount)} · {s.status === "paid" ? "paid" : "approved"}</p>) : <p className="text-sm text-zinc-400">Not worked out</p>}</div>
    </summary>

    <div className="mt-4 space-y-3">
      <Feedback error={error} message={message} />
      <label className="block text-xs text-zinc-400">Technician who did the work
        <select value={techId} onChange={(e) => changeTech(e.target.value)} className={`${field} mt-1 w-full`}>{staff.map((s) => <option key={s.profileId} value={s.profileId}>{s.fullName}{s.payType === "piece" ? ` · piece ${Math.round(s.pieceRate * 1000) / 10}%` : " · hourly"}</option>)}</select>
      </label>
      {tech?.payType === "hourly" ? <p className="text-xs text-amber-200">{tech.fullName} is set to hourly. You can still save piece pay for this job.</p> : null}

      <div className="overflow-hidden rounded-xl border border-[#2d7dff]/15">
        <div className="grid grid-cols-[1fr_90px_100px_90px] gap-2 bg-[#0A1A33] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-300"><span>Item</span><span className="text-right">Customer pays</span><span className="text-right">Your cost</span><span className="text-right">You keep</span></div>
        {job.lines.map((line) => { const cost = Number(costs[line.key]) || 0; return <div key={line.key} className="grid grid-cols-[1fr_90px_100px_90px] items-center gap-2 border-t border-[#2d7dff]/10 px-3 py-2 text-sm">
          <span className="min-w-0 truncate text-zinc-200" title={line.label}>{line.label}</span>
          <span className="text-right text-zinc-300">{money(line.customerPays)}</span>
          <input aria-label={`Your cost for ${line.label}`} type="number" inputMode="decimal" min="0" step="0.01" value={costs[line.key] ?? ""} disabled={locked} onChange={(e) => setCosts((cur) => ({ ...cur, [line.key]: e.target.value }))} className="w-full rounded-lg border border-amber-300/40 bg-black px-2 py-1.5 text-right text-white disabled:opacity-50" />
          <span className="text-right text-zinc-100">{money(line.customerPays - cost)}</span>
        </div>; })}
        {job.adjustments.map((a) => <div key={a.label} className="grid grid-cols-[1fr_90px_100px_90px] gap-2 border-t border-[#2d7dff]/10 px-3 py-2 text-sm text-emerald-200"><span>{a.label}</span><span className="text-right">{money(a.amount)}</span><span /><span className="text-right">{money(a.amount)}</span></div>)}
        <div className="grid grid-cols-[1fr_90px_100px_90px] gap-2 border-t border-[#8ffafa]/30 bg-black/50 px-3 py-2 text-sm font-bold text-white"><span>Total</span><span className="text-right">{money(math.revenue)}</span><span className="text-right">{money(math.cost)}</span><span className="text-right text-[#bafcfc]">{money(math.kept)}</span></div>
      </div>
      <p className="text-xs text-zinc-500">Enter what you paid for each part and material. Labor and trip lines usually cost $0. Sales tax isn&apos;t counted.</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-zinc-400">Share of what you keep<span className="mt-1 flex items-center gap-1"><input type="number" inputMode="decimal" min="0" max="100" step="0.5" value={ratePercent} disabled={locked} onChange={(e) => setRatePercent(e.target.value)} className={`${field} w-24`} /><span className="text-zinc-300">%</span></span></label>
        <div className="text-xs text-zinc-400">At that rate<p className="mt-2 text-base text-white">{money(math.exact)}</p></div>
        <div className="text-xs text-zinc-400">Recommended (to $25)<p className="mt-2 text-base font-semibold text-[#bafcfc]">{money(math.recommended)}</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-zinc-400">Pay for this job<input type="number" inputMode="decimal" min="0" step="1" value={payOverride === "" ? String(math.recommended) : payOverride} disabled={locked || callback} onChange={(e) => setPayOverride(e.target.value)} className={`${field} mt-1 w-full text-lg font-semibold disabled:opacity-50`} /></label>
        <label className="mt-5 inline-flex items-center gap-2 text-sm text-zinc-200"><input type="checkbox" checked={callback} disabled={locked} onChange={(e) => setCallback(e.target.checked)} className="h-4 w-4" />Callback: redo of his own work within 30 days ($0)</label>
      </div>
      <p className="text-sm text-zinc-300">You keep after this pay: <span className="font-semibold text-white">{money(math.kept - finalPay)}</span> <span className="text-zinc-500">(before truck, insurance and overhead)</span></p>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} disabled={locked} placeholder="Note (optional)" className={`${field} w-full`} />
      {locked ? <p className="text-sm text-emerald-300">Paid {savedFor?.paidAt ? new Date(savedFor.paidAt).toLocaleDateString("en-US", { timeZone: "America/Chicago" }) : ""}. Locked.</p> : <div className="flex gap-2">
        <button type="button" onClick={save} disabled={pending || !techId} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#8ffafa]/50 bg-[#2d7dff]/20 px-4 font-semibold text-white disabled:opacity-40"><Save className="h-4 w-4" />{pending ? "Saving…" : savedFor ? "Update approved pay" : `Approve ${money(finalPay)}`}</button>
        {savedFor ? <button type="button" onClick={remove} disabled={pending} aria-label="Remove approved pay" className="rounded-xl border border-rose-500/30 px-3 text-rose-200 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button> : null}
      </div>}
    </div>
  </details>;
}

/** Approved pay waiting to go out, grouped by technician, with Mark paid. */
export function PiecePayLedger({ unpaid }: { unpaid: SavedPiecePay[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rows: SavedPiecePay[] }>();
    for (const row of unpaid) { const g = map.get(row.technicianId) ?? { name: row.technicianName, rows: [] }; g.rows.push(row); map.set(row.technicianId, g); }
    return [...map.entries()];
  }, [unpaid]);
  if (!unpaid.length) return <p className="text-sm text-zinc-400">No approved pay waiting. Approve jobs below and they&apos;ll collect here until you pay them out.</p>;
  const pay = (ids: string[], name: string, total: number) => {
    setError(null); setMessage(null);
    start(async () => { const result = await markPiecePayPaidAction(ids); if (!result.ok) setError(result.error); else { setMessage(`${name}: ${money(total)} marked paid.`); router.refresh(); } });
  };
  return <div className="space-y-3">
    <Feedback error={error} message={message} />
    {groups.map(([id, g]) => { const total = g.rows.reduce((s, r) => s + r.payAmount, 0); return <div key={id} className="rounded-2xl border border-amber-300/30 bg-amber-500/[0.05] p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-white">{g.name}</p><p className="text-xs text-zinc-400">{g.rows.length} job{g.rows.length === 1 ? "" : "s"} approved, not paid yet</p></div><p className="text-2xl font-semibold text-amber-100">{money(total)}</p></div>
      <ul className="mt-3 space-y-1 text-sm">{g.rows.map((r) => <li key={r.id} className="flex justify-between gap-3 text-zinc-300"><span className="min-w-0 truncate">{r.invoiceNumber} · {r.customerName}{r.isCallback ? " · callback" : ""}</span><span className="shrink-0 text-white">{money(r.payAmount)}</span></li>)}</ul>
      <button type="button" disabled={pending} onClick={() => pay(g.rows.map((r) => r.id), g.name, total)} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 px-4 text-sm font-semibold text-emerald-100 disabled:opacity-40"><Check className="h-4 w-4" />Mark {money(total)} paid to {g.name.split(" ")[0]}</button>
    </div>; })}
  </div>;
}
