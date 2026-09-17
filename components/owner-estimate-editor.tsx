"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { replaceEstimateLinesForManagerAction } from "@/lib/chillbros/owner-estimate-actions";
import type { DetailedInvoice } from "@/lib/chillbros/types";

type DraftLine = {
  id: string;
  label: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxable: boolean;
};

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function makeLine(item?: DetailedInvoice["lineItems"][number]): DraftLine {
  return {
    id: item?.id ?? crypto.randomUUID(),
    label: item?.label ?? "",
    description: item?.description ?? "",
    quantity: String(item?.quantity ?? 1),
    unitPrice: item ? String(item.unitPrice) : "",
    taxable: Boolean(item?.taxable),
  };
}

export function OwnerEstimateEditor({ invoice }: { invoice: DetailedInvoice }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<DraftLine[]>(() => invoice.lineItems.length ? invoice.lineItems.map(makeLine) : [makeLine()]);
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const subtotal = useMemo(() => lines.reduce((sum, line) => {
    const quantity = Number(line.quantity);
    const price = Number(line.unitPrice);
    return sum + (Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : 0);
  }, 0), [lines]);

  const updateLine = (id: string, patch: Partial<Omit<DraftLine, "id">>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  const addLine = () => setLines((current) => current.length >= 20 ? current : [...current, makeLine()]);
  const removeLine = (id: string) => setLines((current) => current.length <= 1 ? current : current.filter((line) => line.id !== id));

  const save = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
      const result = await replaceEstimateLinesForManagerAction(invoice.id, lines.map((line) => ({
        label: line.label.trim(),
        description: line.description.trim(),
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        taxable: line.taxable,
      })), notes);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Owner revision saved. Customer view and invoice totals updated.");
      router.refresh();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Price changes could not be saved."); }
    });
  };

  return <details className="rounded-2xl border border-[#8ffafa]/35 bg-[#08131a]/70 p-4" open>
    <summary className="cursor-pointer list-none">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Owner override</p><p className="mt-1 font-medium text-white">Edit prices</p><p className="mt-1 text-xs text-zinc-400">Save corrections, then Finalize & email from the invoice controls.</p></div>
        <p className="text-lg font-semibold text-[#bafcfc]">{money(subtotal)}</p>
      </div>
    </summary>

    <div className="mt-4 space-y-3">
      {error ? <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
      {message ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p> : null}

      {lines.map((line, index) => <div key={line.id} className="rounded-xl border border-[#2d7dff]/15 bg-black/45 p-3">
        <div className="mb-2 flex items-center justify-between"><span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Line {index + 1}</span><button type="button" onClick={() => removeLine(line.id)} disabled={pending || lines.length <= 1} className="rounded-lg p-1.5 text-rose-300 disabled:opacity-30" aria-label={`Remove line ${index + 1}`}><Trash2 className="h-4 w-4" /></button></div>
        <div className="grid gap-2 sm:grid-cols-[1fr_90px_130px]">
          <input value={line.label} onChange={(e) => updateLine(line.id, { label: e.target.value })} maxLength={200} placeholder="Line item" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
          <input aria-label="Quantity" type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: e.target.value })} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
          <input aria-label="Unit price" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
        </div>
        <textarea value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value })} maxLength={1000} rows={2} placeholder="Description / scope" className="mt-2 w-full rounded-xl border border-[#2d7dff]/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-300" />
        <label className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={line.taxable} onChange={(e) => updateLine(line.id, { taxable: e.target.checked })} />Taxable line</label>
      </div>)}

      <button type="button" onClick={addLine} disabled={pending || lines.length >= 20} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-sm text-[#d9fbff] disabled:opacity-40"><Plus className="h-4 w-4" />Add line item</button>

      <label className="block space-y-1"><span className="text-xs text-zinc-400">Customer notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} className="w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label>

      <button type="button" onClick={save} disabled={pending || subtotal <= 0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#8ffafa]/45 bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] disabled:opacity-50"><Save className="h-4 w-4" />{pending ? "Saving owner revision..." : "Save owner revision"}</button>
    </div>
  </details>;
}
