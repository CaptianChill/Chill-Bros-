"use client";

import { PackagePlus, Plus, Save, Search, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AiTextAssist } from "@/components/ai-text-assist";
import { VoiceDictationButton } from "@/components/voice-dictation-button";
import { reviseUnpaidDocumentAction } from "@/lib/chillbros/document-revision-actions";
import type { DetailedInvoice } from "@/lib/chillbros/types";

type DraftLine = { id: string; label: string; description: string; quantity: string; unitPrice: string; taxable: boolean };
type JobPart = { id: string; name: string; partNumber: string; retailPrice: number; quantity: number };
type CatalogPart = { id: string; name: string; partNumber: string; retailPrice: number };

const MAX_LINES = 40;
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const round2 = (value: number) => Math.round(value * 100) / 100;
const partLabel = (part: { name: string; partNumber: string }) => (part.partNumber ? `${part.name} (${part.partNumber})` : part.name).slice(0, 200);

function makeLine(item?: Partial<DetailedInvoice["lineItems"][number]>): DraftLine {
  return {
    id: crypto.randomUUID(),
    label: item?.label ?? "",
    description: item?.description ?? "",
    quantity: String(item?.quantity ?? 1),
    unitPrice: item?.unitPrice !== undefined ? String(item.unitPrice) : "",
    taxable: Boolean(item?.taxable),
  };
}

/**
 * One editor for every unpaid quote or invoice. Saving never un-approves the
 * document, so an invoice that is ready to pay stays ready to pay.
 */
export function OwnerEstimateEditor({ invoice, equipment = [], currentEquipmentId = null, jobParts = [], catalog = [] }: {
  invoice: DetailedInvoice;
  equipment?: { id: string; label: string }[];
  currentEquipmentId?: string | null;
  jobParts?: JobPart[];
  catalog?: CatalogPart[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<DraftLine[]>(() => invoice.lineItems.length ? invoice.lineItems.map(makeLine) : [makeLine()]);
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [equipmentId, setEquipmentId] = useState(currentEquipmentId ?? "");
  const [dpType, setDpType] = useState<"" | "percent" | "dollar">(invoice.downPaymentType ?? "");
  const [dpValue, setDpValue] = useState(invoice.downPaymentType ? String(invoice.downPaymentValue) : "");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const dpLocked = invoice.downPaymentStatus === "paid";
  const ready = invoice.status === "approved";
  const issued = Boolean(invoice.issuedAt);

  const totals = useMemo(() => {
    let subtotal = 0; let taxableSubtotal = 0;
    for (const line of lines) {
      const amount = round2((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));
      subtotal += amount; if (line.taxable) taxableSubtotal += amount;
    }
    const discount = invoice.discountType === "percent" ? round2(subtotal * Math.min(invoice.discountValue, 100) / 100) : invoice.discountType === "dollar" ? Math.min(invoice.discountValue, subtotal) : 0;
    const taxableAfter = subtotal > 0 ? Math.max(0, taxableSubtotal - round2(discount * taxableSubtotal / subtotal)) : 0;
    const tax = round2(taxableAfter * Math.max(0, invoice.taxRate || 0) / 100);
    const total = Math.max(0, subtotal - discount) + tax;
    const dpNumber = Math.max(0, Number(dpValue) || 0);
    const downPayment = dpLocked ? invoice.downPaymentAmount : dpType === "percent" ? round2(total * Math.min(dpNumber, 100) / 100) : dpType === "dollar" ? round2(Math.min(dpNumber, total)) : 0;
    const afterCredits = Math.max(0, total - invoice.creditAmount);
    return { subtotal, discount, tax, total, downPayment, balance: Math.max(0, afterCredits - Math.min(downPayment, afterCredits)) };
  }, [lines, invoice, dpType, dpValue, dpLocked]);

  const updateLine = (id: string, patch: Partial<Omit<DraftLine, "id">>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  const addLine = (line = makeLine()) => setLines((current) => {
    if (current.length >= MAX_LINES) return current;
    // Replace a single empty starter line instead of stacking under it.
    if (current.length === 1 && !current[0].label.trim() && !current[0].unitPrice) return [line];
    return [...current, line];
  });
  const removeLine = (id: string) => setLines((current) => current.length <= 1 ? current : current.filter((line) => line.id !== id));

  const onDocument = new Set(lines.map((line) => line.label.trim().toLowerCase()));
  const newJobParts = jobParts.filter((part) => !onDocument.has(partLabel(part).toLowerCase()));
  const addJobParts = () => {
    setLines((current) => {
      const base = current.length === 1 && !current[0].label.trim() && !current[0].unitPrice ? [] : current;
      const added = newJobParts.map((part) => makeLine({ label: partLabel(part), quantity: part.quantity, unitPrice: part.retailPrice, taxable: true }));
      return [...base, ...added].slice(0, MAX_LINES);
    });
    setMessage(`Added ${newJobParts.length} part${newJobParts.length === 1 ? "" : "s"} from the call. Check prices, then Save.`);
  };
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length < 2) return [];
    return catalog.filter((part) => `${part.name} ${part.partNumber}`.toLowerCase().includes(term)).slice(0, 8);
  }, [catalog, search]);

  const save = () => {
    setError(null); setMessage(null);
    if (dpType && !dpLocked && !(Number(dpValue) > 0)) { setError("Enter the down payment amount, or set it to None."); return; }
    startTransition(async () => {
      try {
        const result = await reviseUnpaidDocumentAction(invoice.id, {
          lines: lines.map((line) => ({ label: line.label.trim(), description: line.description.trim(), quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), taxable: line.taxable })),
          notes,
          equipmentId: equipment.length ? (equipmentId || null) : undefined,
          downPayment: { type: dpType || null, value: Number(dpValue) || 0 },
        });
        if (!result.ok) { setError(result.error); return; }
        const { newTotal, downPaymentAmount, downPaymentPaid, warning } = result.data;
        setMessage([
          `Saved. Total is now ${money(newTotal)}.`,
          downPaymentAmount > 0 ? (downPaymentPaid ? `Down payment of ${money(downPaymentAmount)} already received.` : `Customer can pay the ${money(downPaymentAmount)} down payment right now from their link.`) : null,
          ready ? "Still ready to pay — no re-approval needed." : null,
          warning ?? null,
        ].filter(Boolean).join(" "));
        router.refresh();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Changes could not be saved."); }
    });
  };

  const field = "rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white";

  return <section className="rounded-2xl border border-[#8ffafa]/35 bg-[#08131a]/70 p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Edit {issued ? "invoice" : "quote"} {invoice.invoiceNumber}</p>
        <p className="mt-1 font-medium text-white">Parts, equipment, prices & down payment</p>
        <p className="mt-1 text-xs text-zinc-400">{ready ? "This stays ready to pay when you save. The customer's link updates right away." : "Save changes, then finalize or send it below."}</p>
      </div>
      <p className="text-lg font-semibold text-[#bafcfc]">{money(totals.total)}</p>
    </div>

    <div className="mt-4 space-y-3">
      {error ? <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
      {message ? <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p> : null}

      {newJobParts.length ? <button type="button" onClick={addJobParts} disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"><PackagePlus className="h-4 w-4" />Add {newJobParts.length} part{newJobParts.length === 1 ? "" : "s"} from this call</button> : null}

      {lines.map((line, index) => <div key={line.id} className="rounded-xl border border-[#2d7dff]/15 bg-black/45 p-3">
        <div className="mb-2 flex items-center justify-between"><span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Line {index + 1} · {money(round2((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)))}</span><button type="button" onClick={() => removeLine(line.id)} disabled={pending || lines.length <= 1} className="rounded-lg p-1.5 text-rose-300 disabled:opacity-30" aria-label={`Remove line ${index + 1}`}><Trash2 className="h-4 w-4" /></button></div>
        <div className="grid gap-2 sm:grid-cols-[1fr_90px_130px]">
          <input aria-label={`Line ${index + 1} item`} value={line.label} onChange={(e) => updateLine(line.id, { label: e.target.value })} maxLength={200} placeholder="Part, equipment, labor…" className={field} />
          <input aria-label={`Line ${index + 1} quantity`} type="number" inputMode="decimal" min="0.01" step="0.01" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: e.target.value })} className={field} />
          <input aria-label={`Line ${index + 1} unit price`} type="number" inputMode="decimal" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })} placeholder="$ each" className={field} />
        </div>
        <textarea value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value })} maxLength={1000} rows={2} placeholder="Description / model / serial (optional)" className="mt-2 w-full rounded-xl border border-[#2d7dff]/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-300" />
        <label className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={line.taxable} onChange={(e) => updateLine(line.id, { taxable: e.target.checked })} />Taxable</label>
      </div>)}

      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => addLine()} disabled={pending || lines.length >= MAX_LINES} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-sm text-[#d9fbff] disabled:opacity-40"><Plus className="h-4 w-4" />Add line (part, equipment, labor)</button>
        {catalog.length ? <label className="relative block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search parts list" className={`${field} w-full pl-9`} /></label> : null}
      </div>
      {matches.length ? <div className="space-y-1 rounded-xl border border-[#2d7dff]/20 bg-black/50 p-2">{matches.map((part) => <button key={part.id} type="button" onClick={() => { addLine(makeLine({ label: partLabel(part), quantity: 1, unitPrice: part.retailPrice, taxable: true })); setSearch(""); }} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm text-white hover:bg-[#2d7dff]/15"><span className="min-w-0 truncate">{partLabel(part)}</span><span className="shrink-0 text-[#bafcfc]">{money(part.retailPrice)}</span></button>)}</div> : null}

      <div className="rounded-xl border border-amber-300/30 bg-amber-500/[0.06] p-3">
        <p className="text-sm font-semibold text-amber-100">Down payment</p>
        {dpLocked ? <p className="mt-1 text-sm text-emerald-200">{money(invoice.downPaymentAmount)} already received{invoice.downPaymentMethod ? ` by ${invoice.downPaymentMethod.replace(/_/g, " ")}` : ""}. It comes off the balance automatically.</p> : <>
          <p className="mt-1 text-xs text-zinc-400">The customer can pay this right away from their link. It comes off the total.</p>
          <div className="mt-2 grid grid-cols-[140px_1fr] gap-2">
            <select aria-label="Down payment type" value={dpType} onChange={(e) => setDpType(e.target.value as typeof dpType)} className={field}><option value="">None</option><option value="dollar">Dollar $</option><option value="percent">Percent %</option></select>
            <input aria-label="Down payment amount" type="number" inputMode="decimal" min="0" step="0.01" value={dpValue} onChange={(e) => setDpValue(e.target.value)} disabled={!dpType} placeholder={dpType === "percent" ? "e.g. 50" : "e.g. 500"} className={`${field} disabled:opacity-40`} />
          </div>
        </>}
      </div>

      <div className="rounded-xl border border-[#8ffafa]/25 bg-black/50 p-3 text-sm">
        <div className="flex justify-between text-zinc-300"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
        {totals.discount > 0 ? <div className="mt-1 flex justify-between text-emerald-200"><span>Discount</span><span>-{money(totals.discount)}</span></div> : null}
        <div className="mt-1 flex justify-between text-zinc-300"><span>Sales tax ({invoice.taxRate}%)</span><span>{money(totals.tax)}</span></div>
        {invoice.creditAmount > 0 ? <div className="mt-1 flex justify-between text-emerald-200"><span>Credits</span><span>-{money(invoice.creditAmount)}</span></div> : null}
        <div className="mt-2 flex justify-between border-t border-[#2d7dff]/20 pt-2 text-lg font-bold text-white"><span>Total</span><span className="text-[#bafcfc]">{money(Math.max(0, totals.total - invoice.creditAmount))}</span></div>
        {totals.downPayment > 0 ? <>
          <div className="mt-1 flex justify-between font-semibold text-amber-100"><span>{dpLocked ? "Down payment received" : "Down payment due now"}</span><span>{money(totals.downPayment)}</span></div>
          <div className="mt-1 flex justify-between text-zinc-300"><span>Balance after down payment</span><span>{money(totals.balance)}</span></div>
        </> : null}
      </div>

      {equipment.length ? <label className="block space-y-1"><span className="text-xs text-zinc-400">Equipment being serviced</span><select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className={`${field} w-full`}><option value="">No specific unit</option>{equipment.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label> : null}

      <label className="block space-y-1"><span className="text-xs text-zinc-400">Customer notes (shown on the document)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} className={`${field} w-full`} /><div className="flex flex-wrap items-center gap-2"><VoiceDictationButton getValue={() => notes} setValue={(next) => setNotes(next.slice(0, 2000))} /><AiTextAssist getValue={() => notes} setValue={(next) => setNotes(next.slice(0, 2000))} /></div></label>

      <button type="button" onClick={save} disabled={pending || totals.subtotal <= 0} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#8ffafa]/45 bg-[#2d7dff]/20 px-4 py-3 font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{pending ? "Saving…" : "Save changes"}</button>
    </div>
  </section>;
}
