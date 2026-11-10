"use client";

import { useMemo, useState, useTransition } from "react";
import { PACKS } from "@/lib/brand";
import { saveCall } from "./actions";

type Buyer = { name: string; trade: string; phone: string; address: string; license: string; contact?: string };

// Same honest call script as the main app's buyer-scripts.ts (2026-11-09 launch menu).
const NEEDS: Record<string, [string, string]> = {
  Electricians: ["electricians", "panels, kitchen circuits and lighting before inspection"],
  Plumbers: ["plumbers", "rough-in, grease traps and backflow before opening day"],
  "Pest control": ["pest control companies", "a pest program in place before the health inspection"],
  "HVAC & refrigeration": ["HVAC and refrigeration companies", "rooftop units, walk-in coolers and ice machines installed and serviced"],
  "Sign companies": ["sign companies", "storefront and pylon signs before opening day"],
};
const OPENER: Record<string, string> = Object.fromEntries(Object.entries(NEEDS).map(([t, [plural, need]]) => [t,
  `Hi, this is [you] with San Antonio New Openings. We track new commercial build-outs in San Antonio from Texas state filings: restaurants, retail and auto shops. Jobs like these often need ${need}. Each card shows the project stage, who's listed on the filing and why it may fit. No more than 3 ${plural} get the same project. Can I text you a real example? Packs start at $49 for 5 projects.`]));
const OUTCOMES: [string, string][] = [["", "Not called"], ["called", "No answer / left VM"], ["callback", "Call back"], ["interested", "Interested, sent link"], ["sold", "Sold"], ["not_interested", "Not interested"], ["wrong_number", "Wrong number"]];
const TONE: Record<string, string> = { sold: "text-emerald-300", interested: "text-[#F5C542]", callback: "text-[#7FD4FF]" };

export function CallList({ buyers, marks }: { buyers: Buyer[]; marks: Record<string, { status: string }> }) {
  const [trade, setTrade] = useState("All");
  const [q, setQ] = useState("");
  const [hideCalled, setHideCalled] = useState(false);
  const [called, setCalled] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, v.status])));
  const [failed, setFailed] = useState(false);
  const [, start] = useTransition();
  const mark = (b: Buyer, status: string) => {
    const before = called[b.license] ?? "";
    setCalled((prev) => { const next = { ...prev }; if (status) next[b.license] = status; else delete next[b.license]; return next; });
    start(async () => {
      const ok = await saveCall(b.license, b.name, status);
      setFailed(!ok);
      if (!ok) setCalled((prev) => { const next = { ...prev }; if (before) next[b.license] = before; else delete next[b.license]; return next; });
    });
  };
  const trades = ["All", ...Array.from(new Set(buyers.map((b) => b.trade)))];
  const rows = useMemo(() => buyers.filter((b) => (trade === "All" || b.trade === trade) && (!q || b.name.toLowerCase().includes(q.toLowerCase())) && (!hideCalled || !called[b.license])), [buyers, trade, q, hideCalled, called]);
  const growth = PACKS.find((p) => p.key === "growth")!;

  if (!buyers.length) return <p className="mt-6 rounded-xl border border-[#FF7A59]/50 p-3 text-[#FF7A59]">The state license data didn&apos;t load. Try again in a few minutes.</p>;
  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap gap-2 text-sm">
        {trades.map((t) => <button key={t} onClick={() => setTrade(t)} className={`rounded-full border px-4 py-2 ${trade === t ? "border-[#F5C542] text-[#F5C542]" : "border-white/15 text-[#C9D6E3]"}`}>{t}</button>)}
        <label className="ml-auto flex items-center gap-2 text-[#C9D6E3]"><input type="checkbox" checked={hideCalled} onChange={(e) => setHideCalled(e.target.checked)} /> Hide called</label>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company name" className="h-11 w-full rounded-xl border border-white/15 bg-black/30 px-4" />
      {failed ? <p className="rounded-xl border border-[#FF7A59]/50 p-2 text-sm text-[#FF7A59]">That last update didn&apos;t save. Check your connection and try again.</p> : null}
      <p className="text-sm text-[#8A9BB0]">{rows.length} contractors · {Object.keys(called).length} called · {Object.values(called).filter((v) => v === "sold").length} sold · Text after the call: https://san-antonio-new-openings.vercel.app{growth.href}</p>
      {trade !== "All" && OPENER[trade] ? <p className="rounded-xl border border-[#7FD4FF]/30 bg-[#12304D] p-3 text-sm">&ldquo;{OPENER[trade]}&rdquo;</p> : null}
      <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/30">
        {rows.slice(0, 300).map((b) => (
          <li key={b.license + b.name} className={`flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap ${called[b.license] && !TONE[called[b.license]] ? "opacity-50" : ""}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{b.name}</p>
              <p className="truncate text-xs text-[#8A9BB0]">{b.trade}{b.contact ? ` · ${b.contact}` : ""} · {b.address}</p>
            </div>
            {b.phone ? <a href={`tel:${b.phone.replace(/\D/g, "")}`} className="shrink-0 rounded-xl border border-emerald-300/40 px-3 py-2 text-sm font-semibold text-emerald-200">{b.phone}</a>
              : <a href={`https://www.google.com/search?q=${encodeURIComponent(`${b.name} San Antonio TX phone`)}`} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl border border-[#7FD4FF]/40 px-3 py-2 text-sm font-semibold text-[#7FD4FF]">Find number ↗</a>}
            <select aria-label={`Call result for ${b.name}`} value={called[b.license] ?? ""} onChange={(e) => mark(b, e.target.value)} className={`h-10 shrink-0 rounded-lg border border-white/15 bg-[#0B1E33] px-2 text-xs ${TONE[called[b.license] ?? ""] ?? "text-[#C9D6E3]"}`}>{OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </li>
        ))}
      </ul>
      {rows.length > 300 ? <p className="text-xs text-[#8A9BB0]">Showing the first 300. Search or filter to narrow.</p> : null}
    </div>
  );
}
