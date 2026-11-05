"use client";

import { useMemo, useState, useTransition } from "react";

import { saveBuyerCall } from "@/app/revenue-radar/buyers/actions";
import { CALL_RESULTS } from "@/lib/chillbros/leadbiz/buyer-scripts";

type Row = { license: string; trade: string; name: string; phone: string | null; address: string | null; contact: string | null; status: string | null };
const TONE: Record<string, string> = { sold: "text-emerald-300", interested: "text-amber-200", callback: "text-cyan-200" };

export function BuyerChecklist({ rows, scripts }: { rows: Row[]; scripts: Record<string, string> }) {
  const [trade, setTrade] = useState("All");
  const [q, setQ] = useState("");
  const [hideDone, setHideDone] = useState(false);
  const [status, setStatus] = useState<Record<string, string>>(() => Object.fromEntries(rows.filter((r) => r.status).map((r) => [r.license, r.status as string])));
  const [failed, setFailed] = useState(false);
  const [, start] = useTransition();
  const trades = ["All", ...Array.from(new Set(rows.map((r) => r.trade)))];
  const shown = useMemo(() => rows.filter((r) => (trade === "All" || r.trade === trade) && (!q || r.name.toLowerCase().includes(q.toLowerCase())) && (!hideDone || !status[r.license])), [rows, trade, q, hideDone, status]);

  const set = (r: Row, value: string) => {
    const before = status[r.license] ?? "";
    const apply = (v: string) => setStatus((prev) => { const next = { ...prev }; if (v) next[r.license] = v; else delete next[r.license]; return next; });
    apply(value);
    start(async () => { const ok = await saveBuyerCall(r.license, r.name, value); setFailed(!ok); if (!ok) apply(before); });
  };
  const done = Object.keys(status).length;

  return <section className="space-y-3">
    <div className="flex flex-wrap gap-2 text-sm">
      {trades.map((t) => <button key={t} onClick={() => setTrade(t)} className={`rounded-full border px-4 py-2 ${trade === t ? "border-cyan-300 bg-cyan-400/10 text-cyan-100" : "border-white/15 text-zinc-300"}`}>{t} <span className="text-zinc-500">{t === "All" ? rows.length : rows.filter((r) => r.trade === t).length}</span></button>)}
      <label className="ml-auto flex items-center gap-2 text-zinc-300"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Hide done</label>
    </div>
    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company name" className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-4 text-white" />
    <p className="text-sm text-zinc-400">{shown.length} shown · {done} done · {Object.values(status).filter((v) => v === "sold").length} sold</p>
    {failed ? <p className="rounded-xl border border-amber-400/60 p-2 text-sm text-amber-200">That last update didn&apos;t save. Check your connection and try again.</p> : null}
    {trade !== "All" && scripts[trade] ? <p className="rounded-xl border border-cyan-300/30 bg-cyan-400/5 p-3 text-sm text-zinc-200">&ldquo;{scripts[trade]}&rdquo;</p> : null}
    <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/30">
      {shown.slice(0, 400).map((r) => {
        const s = status[r.license] ?? "";
        return <li key={r.license} className={`flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap ${s && !TONE[s] ? "opacity-50" : ""}`}>
          <input type="checkbox" aria-label={`Done: ${r.name}`} checked={Boolean(s)} onChange={(e) => set(r, e.target.checked ? "called" : "")} className="h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className={`truncate font-semibold ${s ? "line-through decoration-zinc-500" : "text-white"}`}>{r.name}</p>
            <p className="truncate text-xs text-zinc-400">{r.trade}{r.contact ? ` · ${r.contact}` : ""}{r.address ? ` · ${r.address}` : ""}</p>
          </div>
          {r.phone ? <a href={`tel:${r.phone.replace(/\D/g, "")}`} className="shrink-0 rounded-xl border border-emerald-300/40 px-3 py-2 text-sm font-semibold text-emerald-200">{r.phone}</a>
            : <a href={`https://www.google.com/search?q=${encodeURIComponent(`${r.name} San Antonio TX phone`)}`} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl border border-cyan-300/40 px-3 py-2 text-sm font-semibold text-cyan-200">Find number ↗</a>}
          <select aria-label={`Call result for ${r.name}`} value={s} onChange={(e) => set(r, e.target.value)} className={`h-10 shrink-0 rounded-lg border border-white/15 bg-black px-2 text-xs ${TONE[s] ?? "text-zinc-300"}`}>{CALL_RESULTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </li>;
      })}
    </ul>
    {shown.length > 400 ? <p className="text-xs text-zinc-500">Showing the first 400. Pick a trade or search to narrow, or use the PDFs for the full list.</p> : null}
  </section>;
}
