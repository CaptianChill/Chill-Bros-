"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { updatePriceBookEntryAction } from "@/lib/chillbros/operations";
import type { PriceBookEntry } from "@/lib/chillbros/types";

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function PriceBookAdmin({ entries }: { entries: PriceBookEntry[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of entries) if (!seen.has(entry.categoryKey)) seen.set(entry.categoryKey, entry.category);
    return Array.from(seen, ([key, label]) => ({ key, label }));
  }, [entries]);

  const [categoryKey, setCategoryKey] = useState(categories[0]?.key ?? "");
  const categoryEntries = useMemo(() => entries.filter((entry) => entry.categoryKey === categoryKey), [entries, categoryKey]);
  const [code, setCode] = useState(categoryEntries[0]?.code ?? "");
  const selected = entries.find((entry) => entry.code === code) ?? categoryEntries[0] ?? null;
  const [description, setDescription] = useState(selected?.description ?? "");
  const [value, setValue] = useState(selected && selected.currentValue > 0 ? String(selected.currentValue) : "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const next = categoryEntries[0];
    if (next && !categoryEntries.some((entry) => entry.code === code)) setCode(next.code);
  }, [categoryEntries, code]);

  useEffect(() => {
    if (!selected) return;
    setDescription(selected.description);
    setValue(selected.currentValue > 0 ? String(selected.currentValue) : "");
    setMessage(null);
    setError(null);
  }, [selected?.code, selected?.description, selected?.currentValue]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = () => {
    if (!selected) return;
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await updatePriceBookEntryAction({ code: selected.code, description, currentValue: selected.kind === "policy" ? 0 : Number(value || 0) });
      if (!result.ok) {
        setError(result.error ?? "Could not update price book item.");
        return;
      }
      setMessage("Saved.");
      router.refresh();
    });
  };

  return (
    <details open className="group rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div><p className="font-medium text-white">Master service & parts price book</p><p className="text-xs text-zinc-500">{entries.length} categorized items • manager editable</p></div>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#bafcfc] transition group-open:rotate-180" />
      </summary>
      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Category
            <select value={categoryKey} onChange={(event) => { const nextKey = event.target.value; setCategoryKey(nextKey); const first = entries.find((entry) => entry.categoryKey === nextKey); setCode(first?.code ?? ""); }} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-white">
              {categories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Item
            <select value={selected?.code ?? ""} onChange={(event) => setCode(event.target.value)} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-white">
              {categoryEntries.map((entry) => <option key={entry.code} value={entry.code}>{entry.title}</option>)}
            </select>
          </label>
        </div>
        {selected ? <div className="rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/75 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-base font-semibold text-white">{selected.title}</p><p className="mt-1 text-xs text-zinc-500">Market benchmark: <span className="text-[#bafcfc]">{selected.marketPrice}</span></p></div>
            {selected.kind === "money" && selected.currentValue > 0 ? <span className="rounded-full border border-[#2d7dff]/25 bg-[#2d7dff]/10 px-3 py-1 text-sm font-semibold text-[#d9fbff]">{money(selected.currentValue)}</span> : null}
            {selected.kind === "multiplier" && selected.currentValue > 0 ? <span className="rounded-full border border-[#2d7dff]/25 bg-[#2d7dff]/10 px-3 py-1 text-sm font-semibold text-[#d9fbff]">{selected.currentValue.toFixed(2)}×</span> : null}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto]">
            {selected.kind !== "policy" ? <label className="space-y-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{selected.kind === "multiplier" ? "Current multiplier" : selected.kind === "formula" ? "Optional fixed price" : "Current sell price"}<input type="number" min="0" step={selected.kind === "multiplier" ? "0.05" : "0.01"} value={value} onChange={(event) => setValue(event.target.value)} placeholder={selected.kind === "formula" ? "Leave blank for quote" : "0.00"} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-white" /></label> : <div className="hidden md:block" />}
            <label className="space-y-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Editable description / notes<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={200} className="w-full resize-y rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-white" /></label>
            <div className="flex items-end"><button type="button" onClick={save} disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-2.5 text-sm font-medium text-[#d9fbff] disabled:opacity-50 md:w-auto"><Save className="h-4 w-4" />{pending ? "Saving" : "Save"}</button></div>
          </div>
          {selected.kind === "formula" ? <p className="mt-2 text-xs text-zinc-500">This item is normally quoted by formula or equipment conditions. A fixed override is optional.</p> : null}
          {message ? <p className="mt-3 text-xs text-emerald-300">{message}</p> : null}{error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
        </div> : <p className="text-sm text-zinc-500">No price-book entries are available.</p>}
      </div>
    </details>
  );
}
