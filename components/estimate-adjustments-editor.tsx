"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Calculator, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { updateEstimateAdjustmentsAction } from "@/lib/chillbros/estimate-actions-v2";
import type { AdjustmentType, DetailedInvoice } from "@/lib/chillbros/types";

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function EstimateAdjustmentsEditor({ invoice }: { invoice: DetailedInvoice }) {
  const router = useRouter();
  const [discountType, setDiscountType] = useState<AdjustmentType | null>(invoice.discountType);
  const [discountValue, setDiscountValue] = useState(String(invoice.discountValue ?? 0));
  const [downPaymentType, setDownPaymentType] = useState<AdjustmentType | null>(invoice.downPaymentType);
  const [downPaymentValue, setDownPaymentValue] = useState(String(invoice.downPaymentValue ?? 0));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const subtotal = useMemo(() => invoice.lineItems.reduce((sum, item) => sum + item.amount, 0), [invoice.lineItems]);
  const discount = useMemo(() => { const value = Math.max(0, Number(discountValue || 0)); return discountType === "percent" ? Math.min(subtotal, subtotal * Math.min(100, value) / 100) : discountType === "dollar" ? Math.min(subtotal, value) : 0; }, [discountType, discountValue, subtotal]);
  const total = Math.max(0, subtotal - discount);
  const down = useMemo(() => { const value = Math.max(0, Number(downPaymentValue || 0)); return downPaymentType === "percent" ? Math.min(total, total * Math.min(100, value) / 100) : downPaymentType === "dollar" ? Math.min(total, value) : 0; }, [downPaymentType, downPaymentValue, total]);
  const balance = Math.max(0, total - down);
  const locked = invoice.status === "approved" || invoice.status === "void";

  const save = () => {
    if (locked) return;
    setMessage(null); setError(null);
    startTransition(async () => {
      const result = await updateEstimateAdjustmentsAction(invoice.id, { discountType, discountValue: Number(discountValue || 0), downPaymentType, downPaymentValue: Number(downPaymentValue || 0) });
      if (!result.ok) { setError(result.error); return; }
      setMessage("Pricing adjustments saved everywhere."); router.refresh();
    });
  };

  useEffect(() => { const listener = () => save(); window.addEventListener("chillbros-save", listener); return () => window.removeEventListener("chillbros-save", listener); }, [discountType, discountValue, downPaymentType, downPaymentValue, locked]);

  return <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-3">
    <div className="flex items-center justify-between gap-3"><div><p className="inline-flex items-center gap-2 font-medium text-white"><Calculator className="h-4 w-4 text-[#8ffafa]" />Discount & down payment</p><p className="mt-1 text-xs text-zinc-500">Enter a percentage or dollar amount. Totals calculate instantly.</p></div>{locked ? <span className="text-xs text-zinc-500">Locked after approval</span> : null}</div>
    {error ? <p className="text-xs text-rose-300">{error}</p> : null}{message ? <p className="text-xs text-emerald-300">{message}</p> : null}
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-[#2d7dff]/15 bg-zinc-950/70 p-3"><p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">Discount</p><div className="grid grid-cols-[130px_1fr] gap-2"><select disabled={locked} value={discountType ?? ""} onChange={(e) => setDiscountType((e.target.value || null) as AdjustmentType | null)} className="rounded-lg border border-[#2d7dff]/20 bg-black px-2 py-2 text-sm text-white"><option value="">None</option><option value="percent">Percent %</option><option value="dollar">Dollar $</option></select><input disabled={locked || !discountType} type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); save(); } }} className="rounded-lg border border-[#2d7dff]/20 bg-black px-2 py-2 text-sm text-white disabled:opacity-40" /></div><p className="mt-2 text-sm text-emerald-200">Discount: −{money(discount)}</p></div>
      <div className="rounded-xl border border-[#2d7dff]/15 bg-zinc-950/70 p-3"><p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">Down payment</p><div className="grid grid-cols-[130px_1fr] gap-2"><select disabled={locked} value={downPaymentType ?? ""} onChange={(e) => setDownPaymentType((e.target.value || null) as AdjustmentType | null)} className="rounded-lg border border-[#2d7dff]/20 bg-black px-2 py-2 text-sm text-white"><option value="">None</option><option value="percent">Percent %</option><option value="dollar">Dollar $</option></select><input disabled={locked || !downPaymentType} type="number" min="0" step="0.01" value={downPaymentValue} onChange={(e) => setDownPaymentValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); save(); } }} className="rounded-lg border border-[#2d7dff]/20 bg-black px-2 py-2 text-sm text-white disabled:opacity-40" /></div><p className="mt-2 text-sm text-amber-100">Required: {money(down)}</p></div>
    </div>
    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div><p className="text-zinc-500">Subtotal</p><p className="text-white">{money(subtotal)}</p></div><div><p className="text-zinc-500">Total</p><p className="text-[#bafcfc]">{money(total)}</p></div><div><p className="text-zinc-500">Down payment</p><p className="text-amber-100">{money(down)}</p></div><div><p className="text-zinc-500">Remaining</p><p className="text-white">{money(balance)}</p></div></div>
    {!locked ? <button type="button" onClick={save} disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-sm text-[#d9fbff] disabled:opacity-50"><Save className="h-4 w-4" />{pending ? "Saving…" : "Save pricing terms"}</button> : null}
  </div>;
}
