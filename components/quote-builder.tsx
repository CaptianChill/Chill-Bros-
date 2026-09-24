"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { BadgeCheck, History, Plus, Save, Send, Sparkles, Trash2 } from "lucide-react";

import { createEstimateV2Action } from "@/lib/chillbros/estimate-actions-v2";
import { approveQuoteVerballyAction } from "@/lib/chillbros/quote-actions";

type Line = { id: string; label: string; description: string; quantity: string; unitPrice: string; taxable: boolean };
export type QuoteSuggestion = { label: string; description?: string; quantity: number; unitPrice: number; taxable?: boolean };

const field = "min-h-11 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 text-base font-medium text-[#0A1A33] placeholder:text-[#5B6B82]";
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const newLine = (item?: Partial<QuoteSuggestion>): Line => ({
  id: crypto.randomUUID(),
  label: item?.label ?? "",
  description: item?.description ?? "",
  quantity: String(item?.quantity ?? 1),
  unitPrice: item?.unitPrice ? item.unitPrice.toFixed(2) : "",
  taxable: Boolean(item?.taxable),
});

// One quote for one service call. Lines start from the job's parts and the
// fee settings; anything else (a part priced online or locally, labor) is a
// free line. The draft is kept on this device until the quote is sent.
export function QuoteBuilder({ jobId, suggestions, canApproveVerbally, partsProHref }: { jobId: string; suggestions: QuoteSuggestion[]; canApproveVerbally: boolean; partsProHref: string }) {
  const router = useRouter();
  const storageKey = `chillbros-quote-draft-${jobId}`;
  const [lines, setLines] = useState<Line[]>(() => (suggestions.length ? suggestions.slice(0, 20).map(newLine) : [newLine()]));
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState("8.25");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [edited, setEdited] = useState(false);
  const [restored, setRestored] = useState(false);

  // A quote left unfinished on this device can be picked back up.
  const savedDraft = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return window.localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const restore = () => {
    try {
      const saved = JSON.parse(savedDraft ?? "null") as { lines?: Line[]; notes?: string; taxRate?: string } | null;
      if (saved?.lines?.length) {
        setLines(saved.lines.slice(0, 20));
        setNotes(saved.notes ?? "");
        setTaxRate(saved.taxRate ?? "8.25");
      }
    } catch {
      // A damaged copy is ignored.
    }
    setRestored(true);
  };

  useEffect(() => {
    if (!edited) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ lines, notes, taxRate }));
    } catch {
      // Ignore a full or blocked browser storage.
    }
  }, [edited, storageKey, lines, notes, taxRate]);

  const touch = () => setEdited(true);
  const update = (id: string, patch: Partial<Line>) => {
    touch();
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };
  const subtotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0);
  const taxable = lines.filter((line) => line.taxable).reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0);
  const tax = (taxable * (Number(taxRate) || 0)) / 100;

  const submit = (verbal: boolean) => {
    setError(null);
    const clean = lines.filter((line) => line.label.trim() || line.unitPrice);
    if (!clean.length) return setError("Add at least one line.");
    if (clean.some((line) => !line.label.trim())) return setError("Every line needs a name.");
    const payload = clean.map((line) => ({ label: line.label.trim(), description: line.description.trim(), quantity: Number(line.quantity), unitPrice: Number(line.unitPrice || 0), taxable: line.taxable }));
    const adjustments = { discountType: null, discountValue: 0, downPaymentType: null, downPaymentValue: 0, taxRate: Number(taxRate || 0) };
    startTransition(async () => {
      const result = verbal ? await approveQuoteVerballyAction(jobId, payload, notes, adjustments) : await createEstimateV2Action(jobId, payload, notes, adjustments);
      if (!result.ok) return setError(result.error);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Nothing to clean up.
      }
      const message = verbal ? "Quote approved (verbal). Ready for the work." : "Quote sent to the customer for approval.";
      router.push(`/jobs/${jobId}?success=${encodeURIComponent(message)}`);
    });
  };

  return (
    <div className="cb-new space-y-3.5">
      {savedDraft && !restored && !edited ? (
        <button type="button" onClick={restore} className="cb-card flex min-h-12 w-full items-center justify-center gap-2 p-3 font-semibold text-[#1557B0]">
          <History className="h-5 w-5" aria-hidden="true" />
          Pick up the quote you started on this phone
        </button>
      ) : null}
      <section className="cb-card overflow-hidden" aria-labelledby="quote-lines">
        <div className="flex items-center justify-between gap-3 border-b border-[#0A1A33]/10 px-3.5 py-3">
          <h2 id="quote-lines" className="text-[28px] leading-none">Quote</h2>
          <span className="text-lg font-bold text-[#0A1A33]">{money(subtotal + tax)}</span>
        </div>
        <ol className="divide-y divide-[#0A1A33]/10">
          {lines.map((line, index) => (
            <li key={line.id} className="space-y-2 bg-[#F8FAFD] px-3.5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#2B3F5C]">Line {index + 1}</span>
                <button type="button" onClick={() => { touch(); setLines((current) => (current.length === 1 ? [newLine()] : current.filter((item) => item.id !== line.id))); }} aria-label={`Remove line ${index + 1}`} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#0B5CD5]">
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <label className="block text-sm font-semibold text-[#0A1A33]">
                Item
                <input value={line.label} onChange={(e) => update(line.id, { label: e.target.value })} maxLength={200} placeholder="Part, labor or fee" className={`${field} mt-1`} />
              </label>
              <label className="block text-sm font-semibold text-[#0A1A33]">
                Part # or note (optional)
                <input value={line.description} onChange={(e) => update(line.id, { description: e.target.value })} maxLength={1000} className={`${field} mt-1`} />
              </label>
              <div className="grid grid-cols-[88px_1fr] gap-2">
                <label className="text-sm font-semibold text-[#0A1A33]">
                  Qty
                  <input type="number" inputMode="decimal" min="0.01" step="0.01" value={line.quantity} onChange={(e) => update(line.id, { quantity: e.target.value })} className={`${field} mt-1 text-center`} />
                </label>
                <label className="text-sm font-semibold text-[#0A1A33]">
                  Price each
                  <input type="number" inputMode="decimal" min="0" step="0.01" value={line.unitPrice} onChange={(e) => update(line.id, { unitPrice: e.target.value })} placeholder="$0.00" className={`${field} mt-1`} />
                </label>
              </div>
              <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-[#0A1A33]">
                <input type="checkbox" checked={line.taxable} onChange={(e) => update(line.id, { taxable: e.target.checked })} className="h-5 w-5 accent-[#1557B0]" />
                Taxable
              </label>
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-2 gap-2 border-t border-[#0A1A33]/10 px-3.5 py-3">
          <button type="button" onClick={() => { touch(); setLines((current) => [...current, newLine()]); }} disabled={lines.length >= 20} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#1557B0] bg-[#F8FAFD] font-semibold text-[#1557B0] disabled:opacity-50">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add line
          </button>
          <button type="button" onClick={() => { touch(); setLines((current) => [...current, newLine({ description: "Sourced part" })]); }} disabled={lines.length >= 20} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#1557B0] bg-[#F8FAFD] font-semibold text-[#1557B0] disabled:opacity-50">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Bought part
          </button>
          <Link href={partsProHref} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 text-sm font-semibold text-[#1557B0]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Find the OEM part # with Parts Pro
          </Link>
        </div>
      </section>

      <section className="cb-card space-y-3 p-3.5">
        <label className="block text-sm font-semibold text-[#0A1A33]">
          Tax rate %
          <input type="number" inputMode="decimal" min="0" max="25" step="0.01" value={taxRate} onChange={(e) => { touch(); setTaxRate(e.target.value); }} className={`${field} mt-1`} />
        </label>
        <label className="block text-sm font-semibold text-[#0A1A33]">
          Note to customer (optional)
          <textarea rows={3} value={notes} onChange={(e) => { touch(); setNotes(e.target.value); }} maxLength={2000} className={`${field} mt-1 py-2`} />
        </label>
        <dl className="space-y-1 rounded-xl border border-[#C7D3E2] bg-white px-3 py-2 text-sm">
          <div className="flex justify-between font-medium text-[#2B3F5C]"><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
          <div className="flex justify-between font-medium text-[#2B3F5C]"><dt>Tax</dt><dd>{money(tax)}</dd></div>
          <div className="flex justify-between text-base font-bold text-[#0A1A33]"><dt>Total</dt><dd>{money(subtotal + tax)}</dd></div>
        </dl>
      </section>

      {error ? <p role="alert" className="cb-card p-3 text-sm font-semibold text-[#0B5CD5]">{error}</p> : null}

      <button type="button" onClick={() => submit(false)} disabled={pending} className="flex h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-[#1557B0] text-lg font-bold text-white shadow-[0_2px_8px_rgba(10,26,51,0.25)] transition hover:bg-[#0E3F82] disabled:opacity-60">
        <Send className="h-5 w-5" aria-hidden="true" />
        {pending ? "Saving…" : "Send to customer for approval"}
      </button>
      {canApproveVerbally ? (
        <button type="button" onClick={() => submit(true)} disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1557B0] bg-[#F8FAFD] font-bold text-[#1557B0] disabled:opacity-60">
          <BadgeCheck className="h-5 w-5" aria-hidden="true" />
          Customer approved verbally · skip email
        </button>
      ) : null}
      <Link href="/work" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#1557B0]">
        <Save className="h-4 w-4" aria-hidden="true" />
        Save and finish later
      </Link>
    </div>
  );
}
