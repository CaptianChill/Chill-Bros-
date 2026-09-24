"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { PackagePlus, Trash2 } from "lucide-react";

import { addJobPartAtomicAction, removeJobPartAtomicAction } from "@/lib/chillbros/job-parts";

type JobPart = { id: string; name: string; partNumber: string; retailPrice: number; quantity: number };
type CatalogPart = { id: string; name: string; partNumber: string; retailPrice: number; stock: number; trackInventory: boolean };

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

// Parts on a job, using the existing atomic parts actions (inventory stock is
// adjusted the same way as on the technician screen).
export function JobPartsCard({ jobId, parts, catalog, canEdit }: { jobId: string; parts: JobPart[]; catalog: CatalogPart[]; canEdit: boolean }) {
  const router = useRouter();
  const searchId = useId();
  const partId = useId();
  const qtyId = useId();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const available = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalog
      .filter((part) => !part.trackInventory || part.stock > 0)
      .filter((part) => !term || `${part.name} ${part.partNumber}`.toLowerCase().includes(term))
      .slice(0, 150);
  }, [catalog, search]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return setError(result.error ?? "That didn't save. Try again.");
      router.refresh();
    });
  };

  const add = () => {
    const qty = Number(quantity);
    if (!selected) return setError("Choose a part first.");
    if (!Number.isInteger(qty) || qty < 1) return setError("Quantity must be 1 or more.");
    run(async () => {
      const result = await addJobPartAtomicAction(jobId, selected, qty);
      if (result.ok) {
        setSelected("");
        setQuantity("1");
        setSearch("");
      }
      return result;
    });
  };

  const total = parts.reduce((sum, part) => sum + part.retailPrice * part.quantity, 0);

  return (
    <section id="parts" aria-labelledby="parts-title" className="cb-card scroll-mt-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[#0A1A33]/10 px-3.5 py-3">
        <h2 id="parts-title" className="text-[28px] leading-none">Parts</h2>
        <span className="text-sm font-bold text-[#0A1A33]">{money(total)}</span>
      </div>
      {parts.length === 0 ? (
        <p className="bg-[#F8FAFD] px-3.5 py-3 text-sm font-medium text-[#2B3F5C]">No parts on this job yet.</p>
      ) : (
        <ul className="divide-y divide-[#0A1A33]/10">
          {parts.map((part) => (
            <li key={part.id} className="flex items-center gap-3 bg-[#F8FAFD] px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-[#0A1A33]">{part.name}</p>
                <p className="truncate text-[13px] font-medium text-[#2B3F5C]">
                  {part.partNumber ? `Part # ${part.partNumber} · ` : ""}
                  {part.quantity} × {money(part.retailPrice)}
                </p>
              </div>
              {canEdit ? (
                <button type="button" onClick={() => run(() => removeJobPartAtomicAction(part.id))} disabled={pending} aria-label={`Remove ${part.name}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#0B5CD5] disabled:opacity-50">
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <div className="space-y-2 border-t border-[#0A1A33]/10 px-3.5 py-3">
          <label htmlFor={searchId} className="text-sm font-semibold text-[#0A1A33]">
            Add a part
          </label>
          <input id={searchId} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or part #" className="min-h-11 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 font-medium text-[#0A1A33] placeholder:text-[#5B6B82]" />
          <label htmlFor={partId} className="sr-only">
            Part
          </label>
          <select id={partId} value={selected} onChange={(event) => setSelected(event.target.value)} className="min-h-11 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 font-medium text-[#0A1A33]">
            <option value="">{available.length ? "Choose a part" : "No parts match"}</option>
            {available.map((part) => (
              <option key={part.id} value={part.id}>
                {part.name}
                {part.partNumber ? ` · ${part.partNumber}` : ""}
                {part.trackInventory ? ` · ${part.stock} in stock` : ""}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <label htmlFor={qtyId} className="sr-only">
              Quantity
            </label>
            <input id={qtyId} type="number" inputMode="numeric" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} className="min-h-11 w-24 rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 text-center font-semibold text-[#0A1A33]" />
            <button type="button" onClick={add} disabled={pending} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1557B0] px-4 font-semibold text-white disabled:opacity-60">
              <PackagePlus className="h-5 w-5" aria-hidden="true" />
              {pending ? "Saving…" : "Add part"}
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" className="px-3.5 pb-3 text-sm font-semibold text-[#0B5CD5]">{error}</p> : null}
    </section>
  );
}
