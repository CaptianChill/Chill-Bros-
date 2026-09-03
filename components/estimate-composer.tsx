"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { createEstimateAction } from "@/lib/chillbros/mutations";

type SuggestedItem = { label: string; amount: number };
type DraftItem = { id: string; label: string; amount: string };

function makeDraftItem(item?: SuggestedItem): DraftItem {
  return {
    id: crypto.randomUUID(),
    label: item?.label ?? "",
    amount: item && Number.isFinite(item.amount) ? item.amount.toFixed(2) : "",
  };
}

export function EstimateComposer({ jobId, suggestedItems }: { jobId: string; suggestedItems: SuggestedItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<DraftItem[]>(() => {
    const valid = suggestedItems.filter((item) => item.label.trim() && item.amount >= 0).slice(0, 10);
    return valid.length > 0 ? valid.map((item) => makeDraftItem(item)) : [makeDraftItem()];
  });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = useMemo(
    () => items.reduce((sum, item) => sum + (Number.isFinite(Number(item.amount)) ? Number(item.amount) : 0), 0),
    [items],
  );

  const updateItem = (id: string, patch: Partial<Pick<DraftItem, "label" | "amount">>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    setItems((current) => (current.length >= 10 ? current : [...current, makeDraftItem()]));
  };

  const removeItem = (id: string) => {
    setItems((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)));
  };

  const submit = () => {
    setError(null);
    const lineItems = items.map((item) => ({ label: item.label.trim(), amount: Number(item.amount) }));
    startTransition(async () => {
      const result = await createEstimateAction(jobId, lineItems, notes);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-white">Build customer estimate</p>
            <p className="mt-1 text-sm text-zinc-400">Suggested fees and logged parts are prefilled. Adjust them before publishing.</p>
          </div>
          <p className="text-xl font-semibold text-[#bafcfc]">${total.toFixed(2)}</p>
        </div>
      </div>

      {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="grid gap-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3 sm:grid-cols-[1fr_140px_auto]">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Line {index + 1}</span>
              <input
                value={item.label}
                onChange={(event) => updateItem(item.id, { label: event.target.value })}
                maxLength={200}
                placeholder="Labor, part, service fee..."
                className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#2d7dff]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Amount</span>
              <input
                value={item.amount}
                onChange={(event) => updateItem(item.id, { amount: event.target.value })}
                type="number"
                min="0"
                max="100000"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#2d7dff]"
              />
            </label>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              disabled={items.length === 1 || pending}
              aria-label={`Remove line ${index + 1}`}
              className="self-end rounded-xl border border-[#2d7dff]/20 p-2.5 text-zinc-400 transition hover:border-rose-500/50 hover:text-rose-200 disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        disabled={items.length >= 10 || pending}
        className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-4 py-2 text-sm text-[#d9fbff] transition hover:bg-[#2d7dff]/10 disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
        Add line item
      </button>

      <label className="block space-y-2">
        <span className="text-sm text-zinc-300">Customer notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Scope, exclusions, equipment notes, or approval details"
          className="w-full resize-y rounded-2xl border border-[#2d7dff]/20 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#2d7dff]"
        />
        <span className="text-xs text-zinc-500">{notes.length}/2000</span>
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={pending || total <= 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] transition hover:bg-[#2d7dff]/20 disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {pending ? "Publishing estimate..." : "Publish secure estimate"}
      </button>

      <p className="text-xs leading-5 text-zinc-500">Publishing creates the estimate and all line items in one database transaction. A second active estimate for this job is blocked at the database level.</p>
    </div>
  );
}
