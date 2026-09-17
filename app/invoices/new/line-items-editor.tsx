"use client";

import { useState } from "react";

const input = "min-h-12 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 py-2.5 text-white placeholder:text-zinc-600";
const label = "text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400";
const MAX_LINE_ITEMS = 25;

type PartOption = {
  id: string;
  name: string;
  partNumber?: string | null;
  stock: number;
  retailPrice: number;
};

type FeeOption = {
  id: string;
  label: string;
  amount: number;
};

type PriceBookOption = {
  code: string;
  category: string;
  title: string;
  currentValue: number;
};

type Props = {
  parts: PartOption[];
  fees: FeeOption[];
  priceBook: PriceBookOption[];
};

function usd(value: number) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function LineItemsEditor({ parts, fees, priceBook }: Props) {
  const [rowIds, setRowIds] = useState<number[]>([0]);
  const [nextId, setNextId] = useState(1);

  function addLine() {
    if (rowIds.length >= MAX_LINE_ITEMS) return;
    setRowIds((current) => [...current, nextId]);
    setNextId((current) => current + 1);
  }

  function removeLine(id: number) {
    setRowIds((current) => current.length > 1 ? current.filter((rowId) => rowId !== id) : current);
  }

  return <div className="mt-4 space-y-3">
    {rowIds.map((rowId, i) => <div key={rowId} className="rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/65 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Line {i + 1}</div>
        {rowIds.length > 1 ? <button type="button" onClick={() => removeLine(rowId)} className="rounded-lg border border-rose-400/25 px-2.5 py-1 text-xs font-semibold text-rose-200">Remove</button> : null}
      </div>
      <label className={label}>Inventory / Price Book<select name={`itemPreset${i}`} defaultValue="" className={`${input} mt-1`}>
        <option value="">Manual line item</option>
        {parts.length ? <optgroup label="Inventory parts">{parts.map((part) => <option key={part.id} value={`part:${part.id}`}>{part.name}{part.partNumber ? ` · ${part.partNumber}` : ""} · {part.stock} in stock · {usd(part.retailPrice)}</option>)}</optgroup> : null}
        {fees.length ? <optgroup label="Service fees">{fees.map((fee) => <option key={fee.id} value={`fee:${fee.id}`}>{fee.label} · {usd(fee.amount)}</option>)}</optgroup> : null}
        {priceBook.length ? <optgroup label="Master price book">{priceBook.map((entry) => <option key={entry.code} value={`pb:${entry.code}`}>{entry.category} · {entry.title} · {usd(entry.currentValue)}</option>)}</optgroup> : null}
      </select></label>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1.5fr_90px_130px]">
        <input name={`itemLabel${i}`} placeholder="Manual item name if no preset is selected" className={input} />
        <input name={`itemQty${i}`} type="number" min="0" step="0.01" defaultValue="1" placeholder="Qty" className={input} />
        <input name={`itemPrice${i}`} type="number" min="0" step="0.01" placeholder="Manual price" className={input} />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input name={`itemDescription${i}`} placeholder="Optional description / override" className={input} />
        <label className="flex min-h-12 items-center gap-2 rounded-xl border border-[#2d7dff]/20 px-3 text-sm text-zinc-300"><input name={`itemTaxable${i}`} type="checkbox" /> Taxable</label>
      </div>
    </div>)}

    <button type="button" onClick={addLine} disabled={rowIds.length >= MAX_LINE_ITEMS} className="min-h-12 w-full rounded-2xl border border-[#8ffafa]/35 bg-[#2d7dff]/10 px-4 py-3 text-sm font-semibold text-[#d9fbff] disabled:cursor-not-allowed disabled:opacity-40">
      + Add line item
    </button>
    <p className="text-xs text-zinc-500">Start with one item. Add another only when you need it. Every new line starts at quantity 1.</p>
  </div>;
}
