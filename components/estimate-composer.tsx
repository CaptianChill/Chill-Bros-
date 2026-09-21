"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, Plus, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { AiTextAssist } from "@/components/ai-text-assist";
import { VoiceDictationButton } from "@/components/voice-dictation-button";
import { createEstimateV2Action, type EstimateAdjustments } from "@/lib/chillbros/estimate-actions-v2";
import {
  deleteRemoteFormDraft,
  loadRemoteFormDrafts,
  saveRemoteFormDraft,
  type FormDraft,
} from "@/lib/chillbros/form-drafts";
import type { AdjustmentType } from "@/lib/chillbros/types";

type SuggestedItem = { label: string; description?: string; quantity?: number; unitPrice?: number; amount?: number; taxable?: boolean };
type DraftItem = { id: string; label: string; description: string; quantity: string; unitPrice: string; taxable: boolean };
type EstimateDraftPayload = {
  items: DraftItem[];
  notes: string;
  discountType: AdjustmentType | null;
  discountValue: string;
  downPaymentType: AdjustmentType | null;
  downPaymentValue: string;
  taxRate: string;
  updatedAt: string;
};

function parseEstimateDraft(input: unknown): EstimateDraftPayload | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Partial<EstimateDraftPayload>;
  if (!Array.isArray(value.items) || !value.items.length || typeof value.updatedAt !== "string") return null;
  return {
    items: value.items.slice(0, 20).map((item) => ({
      id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
      label: typeof item.label === "string" ? item.label.slice(0, 200) : "",
      description: typeof item.description === "string" ? item.description.slice(0, 1000) : "",
      quantity: typeof item.quantity === "string" ? item.quantity : "1",
      unitPrice: typeof item.unitPrice === "string" ? item.unitPrice : "",
      taxable: Boolean(item.taxable),
    })),
    notes: typeof value.notes === "string" ? value.notes.slice(0, 2000) : "",
    discountType: value.discountType === "percent" || value.discountType === "dollar" ? value.discountType : null,
    discountValue: typeof value.discountValue === "string" ? value.discountValue : "0",
    downPaymentType: value.downPaymentType === "percent" || value.downPaymentType === "dollar" ? value.downPaymentType : null,
    downPaymentValue: typeof value.downPaymentValue === "string" ? value.downPaymentValue : "0",
    taxRate: typeof value.taxRate === "string" ? value.taxRate : "8.25",
    updatedAt: value.updatedAt,
  };
}


function makeDraftItem(item?: SuggestedItem): DraftItem {
  const unitPrice = item?.unitPrice ?? item?.amount ?? 0;
  return { id: crypto.randomUUID(), label: item?.label ?? "", description: item?.description ?? "", quantity: String(item?.quantity ?? 1), unitPrice: unitPrice > 0 ? unitPrice.toFixed(2) : "", taxable: Boolean(item?.taxable) };
}

function money(value: number) { return value.toLocaleString("en-US", { style: "currency", currency: "USD" }); }

export function EstimateComposer({ jobId, suggestedItems, profileId }: { jobId: string; suggestedItems: SuggestedItem[]; profileId: string }) {
  const router = useRouter();
  const storageKey = `chillbros-estimate-draft-v2-${profileId}-${jobId}`;
  const remoteDraftId = `estimate:${jobId}`;
  const [items, setItems] = useState<DraftItem[]>(() => {
    const valid = suggestedItems.filter((item) => item.label.trim() && (item.unitPrice ?? item.amount ?? 0) >= 0).slice(0, 20);
    return valid.length > 0 ? valid.map((item) => makeDraftItem(item)) : [makeDraftItem()];
  });
  const [notes, setNotes] = useState("");
  const [discountType, setDiscountType] = useState<AdjustmentType | null>(null);
  const [discountValue, setDiscountValue] = useState("0");
  const [downPaymentType, setDownPaymentType] = useState<AdjustmentType | null>(null);
  const [downPaymentValue, setDownPaymentValue] = useState("0");
  const [taxRate, setTaxRate] = useState("8.25");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftStatus, setDraftStatus] = useState("Autosave on");
  const queuedDraft = useRef<FormDraft | null>(null);
  const activeSync = useRef<Promise<boolean> | null>(null);
  const remoteWritable = useRef(false);
  const dirty = useRef(false);
  const publishing = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    remoteWritable.current = false;
    queuedDraft.current = null;
    dirty.current = false;
    publishing.current = false;
    setDraftLoaded(false);
    void (async () => {
      let localDraft: EstimateDraftPayload | null = null;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) localDraft = parseEstimateDraft(JSON.parse(raw));
      } catch {
        // A malformed browser backup is ignored.
      }

      const remoteResult = await loadRemoteFormDrafts({ id: remoteDraftId }, controller.signal);
      remoteWritable.current = remoteResult.ok;
      const remote = remoteResult.drafts[0];
      let remoteDraft: EstimateDraftPayload | null = null;
      const remoteField = remote?.fields.find((field) => field.name === "estimatePayload");
      if (remoteField) {
        try {
          const parsed = parseEstimateDraft(JSON.parse(remoteField.value));
          remoteDraft = parsed ? { ...parsed, updatedAt: remote.updatedAt } : null;
        } catch {
          remoteDraft = null;
        }
      }

      const saved = remoteDraft && (!localDraft || remoteDraft.updatedAt >= localDraft.updatedAt)
        ? remoteDraft
        : localDraft;
      if (!active) return;
      if (saved && !dirty.current) {
        setItems(saved.items);
        setNotes(saved.notes);
        setDiscountType(saved.discountType);
        setDiscountValue(saved.discountValue);
        setDownPaymentType(saved.downPaymentType);
        setDownPaymentValue(saved.downPaymentValue);
        setTaxRate(saved.taxRate);
      }
      setDraftLoaded(true);
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [remoteDraftId, storageKey]);

  const flushRemoteDrafts = useCallback(function flush(): Promise<boolean> {
    if (!remoteWritable.current) return Promise.resolve(false);
    if (activeSync.current) return activeSync.current;
    const running = (async () => {
      let synced = true;
      while (queuedDraft.current) {
        const nextDraft = queuedDraft.current;
        queuedDraft.current = null;
        const saved = await saveRemoteFormDraft(nextDraft);
        if (saved && !queuedDraft.current) {
          const savedField = saved.fields.find((field) => field.name === "estimatePayload");
          if (savedField) {
            try {
              const savedPayload = parseEstimateDraft(JSON.parse(savedField.value));
              if (savedPayload) {
                window.localStorage.setItem(storageKey, JSON.stringify({ ...savedPayload, updatedAt: saved.updatedAt }));
              }
            } catch {
              // A newer in-memory edit remains authoritative.
            }
          }
        }
        synced = Boolean(saved) && synced;
      }
      return synced;
    })();
    activeSync.current = running;
    void running.finally(() => {
      activeSync.current = null;
      if (queuedDraft.current) void flush();
    });
    return running;
  }, [storageKey]);

  const saveDraft = useCallback((syncRemote = true) => {
    const updatedAt = new Date().toISOString();
    const payload: EstimateDraftPayload = {
      items,
      notes,
      discountType,
      discountValue,
      downPaymentType,
      downPaymentValue,
      taxRate,
      updatedAt,
    };
    let savedLocally = true;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      savedLocally = false;
    }

    const url = new URL(window.location.href);
    for (const key of ["draft", "success", "error"]) url.searchParams.delete(key);
    const query = url.searchParams.toString();
    queuedDraft.current = {
      id: remoteDraftId,
      path: `${url.pathname}${query ? `?${query}` : ""}`,
      label: `Estimate draft · ${jobId.slice(0, 8)}`,
      customerId: null,
      formIndex: 0,
      updatedAt,
      fields: [{ name: "estimatePayload", type: "json", value: JSON.stringify(payload), occurrence: 0 }],
    };
    setDraftStatus(savedLocally ? "Saved on device · syncing…" : "Syncing to Neon…");
    if (syncRemote) {
      void flushRemoteDrafts().then((synced) => {
        setDraftStatus(synced ? "Synced to Neon" : savedLocally ? "Saved on device · offline" : "Draft save failed");
      });
    }
  }, [discountType, discountValue, downPaymentType, downPaymentValue, flushRemoteDrafts, items, jobId, notes, remoteDraftId, storageKey, taxRate]);

  useEffect(() => {
    if (!dirty.current || publishing.current) return;
    saveDraft(false);
    if (!draftLoaded) return;
    const timer = window.setTimeout(() => {
      void flushRemoteDrafts().then((synced) => {
        setDraftStatus(synced ? "Synced to Neon" : "Saved on device · offline");
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [draftLoaded, flushRemoteDrafts, saveDraft]);

  useEffect(() => {
    const listener = () => {
      dirty.current = true;
      saveDraft(true);
    };
    window.addEventListener("chillbros-save", listener);
    return () => window.removeEventListener("chillbros-save", listener);
  }, [saveDraft]);

  useEffect(() => {
    const pagehide = () => {
      if (!dirty.current || publishing.current) return;
      saveDraft(false);
      const pendingDraft = queuedDraft.current;
      if (remoteWritable.current && pendingDraft) {
        const body = new Blob([JSON.stringify(pendingDraft)], { type: "application/json" });
        navigator.sendBeacon("/api/form-drafts", body);
      }
    };
    window.addEventListener("pagehide", pagehide);
    return () => window.removeEventListener("pagehide", pagehide);
  }, [saveDraft]);

  const subtotal = useMemo(() => items.reduce((sum, item) => { const q = Number(item.quantity); const p = Number(item.unitPrice); return sum + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0); }, 0), [items]);
  const taxableSubtotal = useMemo(() => items.reduce((sum, item) => { if (!item.taxable) return sum; const q = Number(item.quantity); const p = Number(item.unitPrice); return sum + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0); }, 0), [items]);
  const discount = useMemo(() => { const value = Math.max(0, Number(discountValue || 0)); return discountType === "percent" ? Math.min(subtotal, subtotal * Math.min(value, 100) / 100) : discountType === "dollar" ? Math.min(value, subtotal) : 0; }, [discountType, discountValue, subtotal]);
  const taxableAfterDiscount = subtotal > 0 ? Math.max(0, taxableSubtotal - discount * (taxableSubtotal / subtotal)) : 0;
  const tax = taxableAfterDiscount * Math.max(0, Math.min(25, Number(taxRate || 0))) / 100;
  const total = Math.max(0, subtotal - discount + tax);
  const downPayment = useMemo(() => { const value = Math.max(0, Number(downPaymentValue || 0)); return downPaymentType === "percent" ? Math.min(total, total * Math.min(value, 100) / 100) : downPaymentType === "dollar" ? Math.min(value, total) : 0; }, [downPaymentType, downPaymentValue, total]);
  const balance = Math.max(0, total - downPayment);

  const updateItem = (id: string, patch: Partial<Omit<DraftItem, "id">>) => {
    dirty.current = true;
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };
  const addItem = () => {
    dirty.current = true;
    setItems((current) => current.length >= 20 ? current : [...current, makeDraftItem()]);
  };
  const removeItem = (id: string) => {
    dirty.current = true;
    setItems((current) => current.length === 1 ? current : current.filter((item) => item.id !== id));
  };

  const submit = () => {
    setError(null);
    const lineItems = items.map((item) => ({ label: item.label.trim(), description: item.description.trim(), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), taxable: item.taxable }));
    const adjustments: EstimateAdjustments = { discountType, discountValue: Number(discountValue || 0), downPaymentType, downPaymentValue: Number(downPaymentValue || 0), taxRate: Number(taxRate || 0) };
    startTransition(async () => {
      dirty.current = true;
      publishing.current = true;
      saveDraft(false);
      await flushRemoteDrafts();
      const result = await createEstimateV2Action(jobId, lineItems, notes, adjustments);
      if (!result.ok) { publishing.current = false; setError(result.error); return; }
      queuedDraft.current = null;
      if (activeSync.current) await activeSync.current;
      try { window.localStorage.removeItem(storageKey); } catch { /* browser backup cleanup only */ }
      await deleteRemoteFormDraft(remoteDraftId);
      router.refresh();
    });
  };

  return <div className="space-y-4">
    <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-white">Build customer estimate</p><p className="mt-1 text-sm text-zinc-400">Draft fields sync to Neon and keep an offline browser copy.</p></div><div className="text-right"><p className="text-xs text-zinc-500">Estimated total</p><p className="text-xl font-semibold text-[#bafcfc]">{money(total)}</p><p className="text-[10px] text-emerald-300">{draftStatus}</p></div></div></div>
    {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

    <div className="space-y-3">{items.map((item, index) => {
      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      return <div key={item.id} className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Line {index + 1}</span><span className="text-sm font-medium text-[#bafcfc]">{money(lineTotal)}</span></div><div className="grid gap-2 sm:grid-cols-[1fr_90px_130px_auto]"><input value={item.label} onChange={(e) => updateItem(item.id, { label: e.target.value })} maxLength={200} placeholder="Line item" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /><input aria-label="Quantity" type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: e.target.value })} placeholder="Qty" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /><input aria-label="Unit price" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: e.target.value })} placeholder="Unit $" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /><button type="button" onClick={() => removeItem(item.id)} disabled={items.length === 1 || pending} className="rounded-xl border border-[#2d7dff]/20 p-2 text-zinc-400 hover:text-rose-200 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div><textarea value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} maxLength={1000} rows={2} placeholder="Description / scope for this line item" className="mt-2 w-full resize-y rounded-xl border border-[#2d7dff]/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-300" /><label className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={item.taxable} onChange={(e) => updateItem(item.id, { taxable: e.target.checked })} className="h-4 w-4" />Taxable line item</label></div>;
    })}</div>
    <button type="button" onClick={addItem} disabled={items.length >= 20 || pending} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-4 py-2 text-sm text-[#d9fbff] disabled:opacity-40"><Plus className="h-4 w-4" />Add line item</button>

    <details className="group rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-3" open><summary className="flex cursor-pointer list-none items-center justify-between"><div><p className="font-medium text-white">Discount</p><p className="text-xs text-zinc-500">Percentage or fixed dollar amount</p></div><ChevronDown className="h-4 w-4 text-[#bafcfc] transition group-open:rotate-180" /></summary><div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]"><select value={discountType ?? ""} onChange={(e) => { dirty.current = true; setDiscountType((e.target.value || null) as AdjustmentType | null); }} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white"><option value="">No discount</option><option value="percent">Percentage %</option><option value="dollar">Dollar $</option></select><input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => { dirty.current = true; setDiscountValue(e.target.value); }} disabled={!discountType} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white disabled:opacity-40" /><div className="rounded-xl border border-[#2d7dff]/15 px-3 py-2 text-sm text-emerald-200">− {money(discount)}</div></div></details>

    <details className="group rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-3" open><summary className="flex cursor-pointer list-none items-center justify-between"><div><p className="font-medium text-white">Sales tax</p><p className="text-xs text-zinc-500">Only checked line items are taxed. Verify taxability for the job before publishing.</p></div><ChevronDown className="h-4 w-4 text-[#bafcfc] transition group-open:rotate-180" /></summary><div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]"><label className="text-xs text-zinc-400">Tax rate %<input type="number" min="0" max="25" step="0.001" value={taxRate} onChange={(e) => { dirty.current = true; setTaxRate(e.target.value); }} className="mt-1 w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white" /></label><div className="rounded-xl border border-[#2d7dff]/15 px-3 py-2 text-sm text-zinc-300"><p className="text-xs text-zinc-500">Taxable subtotal</p><p>{money(taxableSubtotal)}</p></div><div className="rounded-xl border border-[#2d7dff]/15 px-3 py-2 text-sm text-[#bafcfc]">+ {money(tax)}</div></div></details>

    <details className="group rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-3" open><summary className="flex cursor-pointer list-none items-center justify-between"><div><p className="font-medium text-white">Down payment</p><p className="text-xs text-zinc-500">Required amount at approval</p></div><ChevronDown className="h-4 w-4 text-[#bafcfc] transition group-open:rotate-180" /></summary><div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]"><select value={downPaymentType ?? ""} onChange={(e) => { dirty.current = true; setDownPaymentType((e.target.value || null) as AdjustmentType | null); }} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white"><option value="">No down payment</option><option value="percent">Percentage %</option><option value="dollar">Dollar $</option></select><input type="number" min="0" step="0.01" value={downPaymentValue} onChange={(e) => { dirty.current = true; setDownPaymentValue(e.target.value); }} disabled={!downPaymentType} className="rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-white disabled:opacity-40" /><div className="rounded-xl border border-[#2d7dff]/15 px-3 py-2 text-sm text-amber-100">{money(downPayment)}</div></div></details>

    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/70 p-4 text-sm sm:grid-cols-5"><div><p className="text-zinc-500">Subtotal</p><p className="mt-1 text-white">{money(subtotal)}</p></div><div><p className="text-zinc-500">Discount</p><p className="mt-1 text-emerald-200">−{money(discount)}</p></div><div><p className="text-zinc-500">Tax</p><p className="mt-1 text-[#bafcfc]">+{money(tax)}</p></div><div><p className="text-zinc-500">Total</p><p className="mt-1 font-semibold text-[#bafcfc]">{money(total)}</p></div><div><p className="text-zinc-500">Balance after deposit</p><p className="mt-1 font-semibold text-white">{money(balance)}</p></div></div>
    <label className="block space-y-2"><span className="text-sm text-zinc-300">Customer notes</span><textarea value={notes} onChange={(e) => { dirty.current = true; setNotes(e.target.value); }} maxLength={2000} rows={4} placeholder="Scope, exclusions, equipment notes, or approval details" className="w-full resize-y rounded-2xl border border-[#2d7dff]/20 bg-black/40 px-4 py-3 text-white" /><span className="text-xs text-zinc-500">{notes.length}/2000</span><div className="mt-1.5 flex flex-wrap items-center gap-2"><VoiceDictationButton getValue={() => notes} setValue={(next) => { dirty.current = true; setNotes(next.slice(0, 2000)); }} /><AiTextAssist getValue={() => notes} setValue={(next) => { dirty.current = true; setNotes(next.slice(0, 2000)); }} /></div></label>
    <button type="button" onClick={submit} disabled={pending || subtotal <= 0} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] disabled:opacity-50"><Send className="h-4 w-4" />{pending ? "Publishing estimate..." : "Publish secure estimate"}</button>
  </div>;
}
