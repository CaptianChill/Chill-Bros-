"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, Plus, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { createEstimateV2Action, type EstimateAdjustments } from "@/lib/chillbros/estimate-actions-v2";
import type { AdjustmentType } from "@/lib/chillbros/types";

type SuggestedItem = { label: string; description?: string; quantity?: number; unitPrice?: number; amount?: number };
type DraftItem = { id: string; label: string; description: string; quantity: string; unitPrice: string };

function makeDraftItem(item?: SuggestedItem): DraftItem {
  const unitPrice = item?.unitPrice ?? item?.amount ?? 0;
  return { id: crypto.randomUUID(), label: item?.label ?? "", description: item?.description ?? "", quantity: String(item?.quantity ?? 1), unitPrice: unitPrice > 0 ? unitPrice.toFixed(2) : "" };
}

function money(value: number) { return value.toLocaleString("en-US", { style: "currency", currency: "USD" }); }

export function EstimateComposer({ jobId, suggestedItems }: { jobId: string; suggestedItems: SuggestedItem[] }) {
  const router = useRouter();
  const storageKey = `chillbros-estimate-draft-${jobId}`;
  const [items, setItems] = useState<DraftItem[]>(() => {
    const valid = suggestedItems.filter((item) => item.label.trim() && (item.unitPrice ?? item.amount ?? 0) >= 0).slice(0, 20);
    return valid.length > 0 ? valid.map((item) => makeDraftItem(item)) : [makeDraftItem()];
  });
  const [notes, setNotes] = useState("");
  const [discountType, setDiscountType] = useState<AdjustmentType | null>(null);
  const [discountValue, setDiscountValue] = useState("0");
  const [downPaymentType, setDownPaymentType] = useState<AdjustmentType | null>(null);
  const [downPaymentValue, setDownPaymentValue] = useState("0");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { items?: DraftItem[]; notes?: string; discountType?: AdjustmentType | null; discountValue?: string; downPaymentType?: AdjustmentType | null; downPaymentValue?: string };
        if (Array.isArray(saved.items) && saved.items.length) setItems(saved.items.slice(0, 20));
        if (typeof saved.notes === "string") setNotes(saved.notes);
        setDiscountType(saved.discountType ?? null); setDiscountValue(saved.discountValue ?? "0"); setDownPaymentType(saved.downPaymentType ?? null); setDownPaymentValue(saved.downPaymentValue ?? "0");
      }
    } catch { /* bad local draft is ignored */ }
    setDraftLoaded(true);
  }, [storageKey]);

  const saveDraft = () => {
    try { window.localStorage.setItem(storageKey, JSON.stringify({ items, notes, discountType, discountValue, downPaymentType, downPaymentValue })); setDraftSaved(true); window.setTimeout(() => setDraftSaved(false), 1200); } catch { /* local storage may be blocked */ }
  };

  useEffect(() => { if (!draftLoaded) return; const timer = window.setTimeout(saveDraft, 450); return () => window.clearTimeout(timer); }, [items, notes, discountType, discountValue, downPaymentType, downPaymentValue, draftLoaded]);
  useEffect(() => { const listener = () => saveDraft(); window.addEventListener("chillbros-save", listener); return () => window.removeEventListener("chillbros-save", listener); }, [items, notes, discountType, discountValue, downPaymentType, downPaymentValue]);

  const subtotal = useMemo(() => items.reduce((sum, item) => { const q = Number(item.quantity); const p = Number(item.unitPrice); return sum + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0); }, 0), [items]);
  const discount = useMemo(() => { const value = Math.max(0, Number(discountValue || 0)); return discountType === "percent" ? Math.min(subtotal, subtotal * Math.min(value, 100) / 100) : discountType === "dollar" ? Math.min(value, subtotal) : 0; }, [discountType, discountValue, subtotal]);
  const total = Math.max(0, subtotal - discount);
  const downPayment = useMemo(() => { const value = Math.max(0, Number(downPaymentValue || 0)); return downPaymentType === "percent" ? Math.min(total, total * Math.min(value, 100) / 100) : downPaymentType === "dollar" ? Math.min(value, total) : 0; }, [downPaymentType, downPaymentValue, total]);
  const balance = Math.max(0, total - downPayment);

  const updateItem = (id: string, patch: Partial<Omit<DraftItem, "id">>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const addItem = () => setItems((current) => current.length >= 20 ? current : [...current, makeDraftItem()]);
  const removeItem = (id: string) => setItems((current) => current.length === 1 ? current : current.filter((item) => item.id !== id));

  const submit = () => {
    setError(null);
    const lineItems = items.map((item) => ({ label: item.label.trim(), description: item.description.trim(), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) }));
    const adjustments: EstimateAdjustments = { discountType, discountValue: Number(discountValue || 0), downPaymentType, downPaymentValue: Number(downPaymentValue || 0) };
    startTransition(async () => {
      const result = await createEstimateV2Action(jobId, lineItems, notes, adjustments);
      if (!result.ok) { setError(result.error); return; }
      try { window.localStorage.removeItem(storageKey); } catch { /* ignore */ }
      router.refresh();
    });
  };

  return <div className="space-y-4">
    <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-white">Build customer estimate</p><p className="mt-1 text-sm text-zinc-400">Draft fields save automatically on this device.</p></div><div className="text-right"><p className="text-xs text-zinc-500">Estimated total</p><p className="text-xl font-semibold text-[#bafcfc]">{money(total)}</p><p className="text-[10px] text-emerald-300">{draftSaved ? "Draft saved" : "Autosave on"}</p></div></div></div>
    {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

    <div className="space-y-3">{items.map((item, index) => {
      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      return <div key={item.id} className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Line {index + 1}</span><span className="text-sm font-medium text-[#bafcfc]">{money(lineTotal)}</span></div><div className="grid gap-2 sm:grid-cols-[1fr_90px_130px_auto]"><input value={item.label} onChange={(e) => updateItem(item.id, { label: e.target.value })} maxLength={200} placeholder="Line item" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /><input aria-label="Quantity" type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: e.target.value })} placeholder="Qty" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /><input aria-label="Unit price" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: e.target.value })} placeholder="Unit $" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /><button type="button" onClick={() => removeItem(item.id)} disabled={items.length === 1 || pending} className="rounded-xl border border-[#2d7dff]/20 p-2 text-zinc-400 hover:text-rose-200 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div><textarea value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} maxLength={1000} rows={2} placeholder="Description / scope for this line item" className="mt-2 w-full resize-y rounded-xl border border-[#2d7dff]/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-300" /></div>;
    })}</div>
    <button type="button" onClick={addItem} disabled={items.length >= 20 || pending} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-4 py-2 text-sm text-[#d9fbff] disabled:opacity-40"><Plus className="h-4 w-4" />Add line item</button>

    <details className="group rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-3" open><summary className="flex cursor-pointer list-none items-center justify-between"><div><p className="font-medium text-white">Discount</p><p className="text-xs text-zinc-500">Percentage or fixed dollar amount</p></div><ChevronDown className="h-4 w-4 text-[#bafcfc] transition group-open:rotate-180" /></summary><div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]"><select value={discountType ?? ""} onChange={(e) => setDiscountType((e.target.value || null) as AdjustmentType | null)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white"><option value="">No discount</option><option value="percent">Percentage %</option><option value="dollar">Dollar $</option></select><input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} disabled={!discountType} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white disabled:opacity-40" /><div className="rounded-xl border border-[#2d7dff]/15 px-3 py-2 text-sm text-emerald-200">− {money(discount)}</div></div></details>

    <details className="group rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-3" open><summary className="flex cursor-pointer list-none items-center justify-between"><div><p className="font-medium text-white">Down payment</p><p className="text-xs text-zinc-500">Required amount at approval</p></div><ChevronDown className="h-4 w-4 text-[#bafcfc] transition group-open:rotate-180" /></summary><div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]"><select value={downPaymentType ?? ""} onChange={(e) => setDownPaymentType((e.target.value || null) as AdjustmentType | null)} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white"><option value="">No down payment</option><option value="percent">Percentage %</option><option value="dollar">Dollar $</option></select><input type="number" min="0" step="0.01" value={downPaymentValue} onChange={(e) => setDownPaymentValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} disabled={!downPaymentType} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white disabled:opacity-40" /><div className="rounded-xl border border-[#2d7dff]/15 px-3 py-2 text-sm text-amber-100">{money(downPayment)}</div></div></details>

    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/70 p-4 text-sm sm:grid-cols-4"><div><p className="text-zinc-500">Subtotal</p><p className="mt-1 text-white">{money(subtotal)}</p></div><div><p className="text-zinc-500">Discount</p><p className="mt-1 text-emerald-200">−{money(discount)}</p></div><div><p className="text-zinc-500">Total</p><p className="mt-1 font-semibold text-[#bafcfc]">{money(total)}</p></div><div><p className="text-zinc-500">Balance after deposit</p><p className="mt-1 font-semibold text-white">{money(balance)}</p></div></div>
    <label className="block space-y-2"><span className="text-sm text-zinc-300">Customer notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={4} placeholder="Scope, exclusions, equipment notes, or approval details" className="w-full resize-y rounded-2xl border border-[#2d7dff]/20 bg-black/40 px-4 py-3 text-white" /><span className="text-xs text-zinc-500">{notes.length}/2000</span></label>
    <button type="button" onClick={submit} disabled={pending || subtotal <= 0} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] disabled:opacity-50"><Send className="h-4 w-4" />{pending ? "Publishing estimate..." : "Publish secure estimate"}</button>
  </div>;
}
