"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { BadgeCheck, History, Plus, ReceiptText, Save, Send, Sparkles, Trash2 } from "lucide-react";

import { createEstimateV2Action } from "@/lib/chillbros/estimate-actions-v2";
import { approveQuoteVerballyAction, createJobInvoiceAction } from "@/lib/chillbros/quote-actions";

type Line = { id: string; label: string; description: string; quantity: string; unitPrice: string; taxable: boolean };
export type QuoteSuggestion = { label: string; description?: string; quantity: number; unitPrice: number; taxable?: boolean };

const compact = "min-h-10 w-full min-w-0 rounded-lg border border-[#C7D3E2] bg-white px-2.5 text-[15px] font-medium text-[#0A1A33] placeholder:text-[#5B6B82]";
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
export function QuoteBuilder({ jobId, suggestions, canApproveVerbally, partsProHref, mode = "quote" }: { jobId: string; suggestions: QuoteSuggestion[]; canApproveVerbally: boolean; partsProHref: string; mode?: "quote" | "invoice" }) {
  const router = useRouter();
  const isInvoice = mode === "invoice";
  const docName = isInvoice ? "invoice" : "quote";
  const storageKey = `chillbros-${docName}-draft-${jobId}`;
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
    if (isInvoice) {
      startTransition(async () => {
        const result = await createJobInvoiceAction(jobId, payload, notes, adjustments);
        if (!result.ok) return setError(result.error);
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          // Nothing to clean up.
        }
        router.push(result.data.redirectTo);
        router.refresh();
      });
      return;
    }
    startTransition(async () => {
      const result = verbal ? await approveQuoteVerballyAction(jobId, payload, notes, adjustments) : await createEstimateV2Action(jobId, payload, notes, adjustments);
      if (!result.ok) return setError(result.error);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Nothing to clean up.
      }
      if (verbal) { router.push(`/jobs/${jobId}?success=${encodeURIComponent("Customer verbal approval recorded. Continue the work, then create the invoice.")}`); } else { router.push(`/jobs/${jobId}?success=${encodeURIComponent("Quote sent to the customer for approval.")}`); }
      router.refresh();
    });
  };

  return (
    <div className="cb-new space-y-3.5">
      {savedDraft && !restored && !edited ? (
        <button type="button" onClick={restore} className="cb-card flex min-h-12 w-full items-center justify-center gap-2 p-3 font-semibold text-[#1B3FD0]">
          <History className="h-5 w-5" aria-hidden="true" />
          Pick up the {docName} you started on this phone
        </button>
      ) : null}
      <section className="cb-card overflow-hidden" aria-labelledby="quote-lines">
        <div className="flex items-center justify-between gap-3 border-b border-[#0A1A33]/10 px-3.5 py-3">
          <h2 id="quote-lines" className="text-[28px] leading-none">{isInvoice ? "Invoice" : "Quote"}</h2>
          <span className="text-lg font-bold text-[#0A1A33]">{money(subtotal + tax)}</span>
        </div>
        <div className="hidden grid-cols-[1fr_64px_96px_84px_36px] gap-2 px-3.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#5B6B82] sm:grid">
          <span>Item</span><span className="text-center">Qty</span><span>Price</span><span className="text-right">Amount</span><span />
        </div>
        <ol className="divide-y divide-[#0A1A33]/10">
          {lines.map((line, index) => {
            const amount = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
            return (
              <li key={line.id} className="bg-[#F8FAFD] px-3.5 py-2">
                <div className="grid grid-cols-[1fr_36px] gap-2 sm:grid-cols-[1fr_64px_96px_84px_36px] sm:items-center">
                  <input value={line.label} onChange={(e) => update(line.id, { label: e.target.value })} maxLength={200} placeholder="Part, labor or fee" aria-label={`Line ${index + 1} item`} className={compact} />
                  <div className="col-span-2 row-start-2 grid grid-cols-[64px_1fr_auto] items-center gap-2 sm:contents">
                    <input type="number" inputMode="decimal" min="0.01" step="0.01" value={line.quantity} onChange={(e) => update(line.id, { quantity: e.target.value })} aria-label={`Line ${index + 1} quantity`} className={`${compact} text-center`} />
                    <input type="number" inputMode="decimal" min="0" step="0.01" value={line.unitPrice} onChange={(e) => update(line.id, { unitPrice: e.target.value })} placeholder="$0.00" aria-label={`Line ${index + 1} price each`} className={compact} />
                    <span className="min-w-[72px] text-right text-sm font-bold text-[#0A1A33]">{money(amount)}</span>
                  </div>
                  <button type="button" onClick={() => { touch(); setLines((current) => (current.length === 1 ? [newLine()] : current.filter((item) => item.id !== line.id))); }} aria-label={`Remove line ${index + 1}`} className="col-start-2 row-start-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-[#1B3FD0] sm:col-start-auto sm:row-start-auto">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <input value={line.description} onChange={(e) => update(line.id, { description: e.target.value })} maxLength={1000} placeholder="Part # or note (optional)" aria-label={`Line ${index + 1} part number or note`} className="min-h-8 flex-1 rounded-lg border border-transparent bg-transparent px-1 text-[13px] text-[#2B3F5C] placeholder:text-[#8A97AA] focus:border-[#C7D3E2] focus:bg-white" />
                  <label className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[#2B3F5C]">
                    <input type="checkbox" checked={line.taxable} onChange={(e) => update(line.id, { taxable: e.target.checked })} className="h-4 w-4 accent-[#1B3FD0]" />
                    Tax
                  </label>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="grid grid-cols-2 gap-2 border-t border-[#0A1A33]/10 px-3.5 py-2.5">
          <button type="button" onClick={() => { touch(); setLines((current) => [...current, newLine()]); }} disabled={lines.length >= 20} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[#1B3FD0] bg-[#F8FAFD] text-sm font-semibold text-[#1B3FD0] disabled:opacity-50">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add line
          </button>
          <button type="button" onClick={() => { touch(); setLines((current) => [...current, newLine({ description: "Sourced part" })]); }} disabled={lines.length >= 20} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[#1B3FD0] bg-[#F8FAFD] text-sm font-semibold text-[#1B3FD0] disabled:opacity-50">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Bought part
          </button>
          <Link href={partsProHref} className="col-span-2 inline-flex min-h-9 items-center justify-center gap-1.5 text-sm font-semibold text-[#1B3FD0]">
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

      {error ? <p role="alert" className="cb-card p-3 text-sm font-semibold text-[#1B3FD0]">{error}</p> : null}

      {isInvoice ? (
        <button type="button" onClick={() => submit(false)} disabled={pending} className="flex h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-[#1B3FD0] text-lg font-bold text-white shadow-[0_2px_8px_rgba(10,26,51,0.25)] transition hover:bg-[#1530A8] disabled:opacity-60">
          <ReceiptText className="h-5 w-5" aria-hidden="true" />
          {pending ? "Creating invoice…" : "Create invoice"}
        </button>
      ) : null}
      {isInvoice ? null : <button type="button" onClick={() => submit(false)} disabled={pending} className="flex h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-[#1B3FD0] text-lg font-bold text-white shadow-[0_2px_8px_rgba(10,26,51,0.25)] transition hover:bg-[#1530A8] disabled:opacity-60">
        <Send className="h-5 w-5" aria-hidden="true" />
        {pending ? "Saving…" : "Send to customer for approval"}
      </button>}
      {canApproveVerbally && !isInvoice ? (
        <button type="button" onClick={() => submit(true)} disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1B3FD0] bg-[#F8FAFD] font-bold text-[#1B3FD0] disabled:opacity-60">
          <BadgeCheck className="h-5 w-5" aria-hidden="true" />
          Customer approved verbally · skip email
        </button>
      ) : null}
      <Link href="/work" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#1B3FD0]">
        <Save className="h-4 w-4" aria-hidden="true" />
        Save and finish later
      </Link>
    </div>
  );
}
