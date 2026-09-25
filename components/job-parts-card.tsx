"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { PackagePlus, Sparkles, Trash2 } from "lucide-react";

import { addJobPartAtomicAction, addNeedToOrderPartAction, removeJobPartAtomicAction, setJobPartFieldAction } from "@/lib/chillbros/job-parts";
import { PART_FIELD_STATUSES, partFieldStatusLabel } from "@/lib/chillbros/work-page";
import { addCustomJobPartAction } from "@/lib/chillbros/quote-actions";

type JobPart = { id: string; name: string; partNumber: string; retailPrice: number; quantity: number };
type CatalogPart = { id: string; name: string; partNumber: string; retailPrice: number; stock: number; trackInventory: boolean };
type PartMeta = Record<string, { fieldStatus: string | null; notes: string | null }>;

const STATUS_CHIP: Record<string, string> = {
  on_truck: "bg-[#E3F4FF] text-[#0A1A33]",
  need_to_order: "bg-[#FFE8C2] text-[#6B3A00]",
  ordered: "bg-[#DCEBFF] text-[#0E3F82]",
};

// Per-part field status (On truck / Need to order / Ordered) and a short note.
function PartFieldEditor({ jobPartId, fieldStatus, notes, onSave, pending }: { jobPartId: string; fieldStatus: string; notes: string; onSave: (id: string, status: string, notes: string) => void; pending: boolean }) {
  const [status, setStatus] = useState(fieldStatus);
  const [text, setText] = useState(notes);
  const selectId = useId();
  return (
    <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
      <label htmlFor={selectId} className="sr-only">Part status</label>
      <select id={selectId} value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-[#C7D3E2] bg-white px-2 font-semibold text-[#0A1A33]">
        {Object.entries(PART_FIELD_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button type="button" disabled={pending || (status === fieldStatus && text === notes)} onClick={() => onSave(jobPartId, status, text)} className="min-h-11 rounded-xl bg-[#1557B0] px-4 text-sm font-semibold text-white disabled:opacity-50">Save</button>
      <input value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} aria-label="Part notes" placeholder="Notes (supplier, ETA, size…)" className="col-span-2 min-h-11 rounded-xl border border-[#C7D3E2] bg-white px-3 font-medium text-[#0A1A33] placeholder:text-[#5B6B82]" />
    </div>
  );
}

const fieldClass = "mt-1 min-h-11 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 font-medium text-[#0A1A33] placeholder:text-[#5B6B82]";
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

// Parts on a job, using the existing atomic parts actions (inventory stock is
// adjusted the same way as on the technician screen). "Bought part" is for a
// part priced from an online or local supplier that isn't normally stocked.
export function JobPartsCard({ jobId, parts, catalog, canEdit, canAddCustom = false, canAddNeedToOrder = false, partMeta, partsProHref, tone = "brand" }: { jobId: string; parts: JobPart[]; catalog: CatalogPart[]; canEdit: boolean; canAddCustom?: boolean; canAddNeedToOrder?: boolean; partMeta?: PartMeta; partsProHref?: string; tone?: "brand" | "solid" }) {
  const router = useRouter();
  const searchId = useId();
  const partId = useId();
  const qtyId = useId();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"stock" | "custom" | "order">("stock");
  const [custom, setCustom] = useState({ name: "", partNumber: "", cost: "", price: "", quantity: "1" });
  const [order, setOrder] = useState({ name: "", partNumber: "", price: "", quantity: "1", notes: "" });
  const modes = ([["stock", "From stock"], ...(canAddCustom ? [["custom", "Bought part"]] : []), ...(canAddNeedToOrder ? [["order", "Need to order"]] : [])] as [typeof mode, string][]);

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

  const addCustom = () => {
    const qty = Number(custom.quantity);
    if (!custom.name.trim()) return setError("Enter the part name.");
    if (custom.price === "" || !(Number(custom.price) >= 0)) return setError("Enter the price you're charging.");
    if (!Number.isInteger(qty) || qty < 1) return setError("Quantity must be 1 or more.");
    run(async () => {
      const result = await addCustomJobPartAction({ jobId, name: custom.name, partNumber: custom.partNumber, cost: Number(custom.cost || 0), price: Number(custom.price), quantity: qty });
      if (result.ok) setCustom({ name: "", partNumber: "", cost: "", price: "", quantity: "1" });
      return result;
    });
  };

  const addOrder = () => {
    const qty = Number(order.quantity);
    if (!order.name.trim()) return setError("Enter the part name.");
    if (!Number.isInteger(qty) || qty < 1) return setError("Quantity must be 1 or more.");
    run(async () => {
      const result = await addNeedToOrderPartAction({ jobId, name: order.name, partNumber: order.partNumber, price: Number(order.price || 0), quantity: qty, notes: order.notes });
      if (result.ok) setOrder({ name: "", partNumber: "", price: "", quantity: "1", notes: "" });
      return result;
    });
  };

  const saveField = (id: string, fieldStatus: string, notes: string) => run(() => setJobPartFieldAction(id, { fieldStatus, notes }));

  const total = parts.reduce((sum, part) => sum + part.retailPrice * part.quantity, 0);

  return (
    <section id="parts" aria-labelledby="parts-title" className={`${tone === "solid" ? "cb-work-card" : "cb-card"} scroll-mt-24 overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-[#0A1A33]/10 px-3.5 py-3">
        <h2 id="parts-title" className="text-[28px] leading-none">Parts</h2>
        <span className="text-sm font-bold text-[#0A1A33]">{money(total)}</span>
      </div>
      {parts.length === 0 ? (
        <p className="bg-[#F8FAFD] px-3.5 py-3 text-sm font-medium text-[#2B3F5C]">No parts on this job yet.</p>
      ) : (
        <ul className="divide-y divide-[#0A1A33]/10">
          {parts.map((part) => (
            <li key={part.id} className="bg-[#F8FAFD] px-3.5 py-2.5">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#0A1A33]">{part.name}</p>
                  <p className="truncate text-[13px] font-medium text-[#2B3F5C]">
                    {part.partNumber ? `Part # ${part.partNumber} · ` : ""}
                    {part.quantity} × {money(part.retailPrice)}
                  </p>
                  {partMeta ? (
                    <p className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${STATUS_CHIP[partMeta[part.id]?.fieldStatus ?? "on_truck"] ?? STATUS_CHIP.on_truck}`}>{partFieldStatusLabel(partMeta[part.id]?.fieldStatus)}</span>
                      {partMeta[part.id]?.notes ? <span className="text-[13px] font-medium text-[#2B3F5C]">{partMeta[part.id]?.notes}</span> : null}
                    </p>
                  ) : null}
                </div>
                {canEdit ? (
                  <button type="button" onClick={() => run(() => removeJobPartAtomicAction(part.id))} disabled={pending} aria-label={`Remove ${part.name}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#0B5CD5] disabled:opacity-50">
                    <Trash2 className="h-5 w-5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              {canEdit && partMeta ? (
                <details className="group">
                  <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-[#1557B0] [&::-webkit-details-marker]:hidden">Status &amp; notes</summary>
                  <PartFieldEditor jobPartId={part.id} fieldStatus={partMeta[part.id]?.fieldStatus ?? "on_truck"} notes={partMeta[part.id]?.notes ?? ""} onSave={saveField} pending={pending} />
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <div className="space-y-2 border-t border-[#0A1A33]/10 px-3.5 py-3">
          {modes.length > 1 ? (
            <div className={`grid gap-2 ${modes.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} role="radiogroup" aria-label="Where the part comes from">
              {modes.map(([value, text]) => (
                <button key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => { setMode(value); setError(null); }} className={`min-h-11 rounded-xl border px-1 text-sm font-semibold leading-tight ${mode === value ? "border-[#1557B0] bg-[#1557B0] text-white" : "border-[#C7D3E2] bg-[#F8FAFD] text-[#0A1A33]"}`}>
                  {text}
                </button>
              ))}
            </div>
          ) : null}
          {mode === "order" && canAddNeedToOrder ? (
            <div className="grid grid-cols-2 gap-2">
              <p className="col-span-2 text-[13px] font-medium text-[#2B3F5C]">A part you don&apos;t have with you. It&apos;s added to the job as <strong>Need to order</strong>; no inventory is taken.</p>
              <label className="col-span-2 text-sm font-semibold text-[#0A1A33]">Part name<input value={order.name} onChange={(e) => setOrder({ ...order, name: e.target.value })} placeholder="e.g. Evaporator fan motor" className={fieldClass} /></label>
              <label className="col-span-2 text-sm font-semibold text-[#0A1A33]">OEM part # (optional)<input value={order.partNumber} onChange={(e) => setOrder({ ...order, partNumber: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-semibold text-[#0A1A33]">Price to customer (optional)<input type="number" inputMode="decimal" min={0} step="0.01" value={order.price} onChange={(e) => setOrder({ ...order, price: e.target.value })} placeholder="$0.00" className={fieldClass} /></label>
              <label className="text-sm font-semibold text-[#0A1A33]">Qty<input type="number" inputMode="numeric" min={1} value={order.quantity} onChange={(e) => setOrder({ ...order, quantity: e.target.value })} className={`${fieldClass} text-center`} /></label>
              <label className="col-span-2 text-sm font-semibold text-[#0A1A33]">Notes<input value={order.notes} maxLength={1000} onChange={(e) => setOrder({ ...order, notes: e.target.value })} placeholder="Supplier, size, voltage…" className={fieldClass} /></label>
              <button type="button" onClick={addOrder} disabled={pending} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1557B0] px-4 font-semibold text-white disabled:opacity-60">
                <PackagePlus className="h-5 w-5" aria-hidden="true" />
                {pending ? "Saving…" : "Add as need to order"}
              </button>
            </div>
          ) : mode === "custom" && canAddCustom ? (
            <div className="grid grid-cols-2 gap-2">
              <p className="col-span-2 text-[13px] font-medium text-[#2B3F5C]">A part you priced online or from a local supply house.</p>
              <label className="col-span-2 text-sm font-semibold text-[#0A1A33]">Part name<input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="e.g. Condenser fan motor 1/3 HP" className={fieldClass} /></label>
              <label className="col-span-2 text-sm font-semibold text-[#0A1A33]">OEM part # (optional)<input value={custom.partNumber} onChange={(e) => setCustom({ ...custom, partNumber: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-semibold text-[#0A1A33]">Your cost<input type="number" inputMode="decimal" min={0} step="0.01" value={custom.cost} onChange={(e) => setCustom({ ...custom, cost: e.target.value })} placeholder="$0.00" className={fieldClass} /></label>
              <label className="text-sm font-semibold text-[#0A1A33]">Price to customer<input type="number" inputMode="decimal" min={0} step="0.01" value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value })} placeholder="$0.00" className={fieldClass} /></label>
              <label className="text-sm font-semibold text-[#0A1A33]">Qty<input type="number" inputMode="numeric" min={1} value={custom.quantity} onChange={(e) => setCustom({ ...custom, quantity: e.target.value })} className={`${fieldClass} text-center`} /></label>
              <button type="button" onClick={addCustom} disabled={pending} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1557B0] px-4 font-semibold text-white disabled:opacity-60">
                <PackagePlus className="h-5 w-5" aria-hidden="true" />
                {pending ? "Saving…" : "Add part"}
              </button>
            </div>
          ) : (
          <>
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
          </>
          )}
          {partsProHref ? (
            <Link href={partsProHref} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#1557B0]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Find the OEM part # with Parts Pro
            </Link>
          ) : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="px-3.5 pb-3 text-sm font-semibold text-[#0B5CD5]">{error}</p> : null}
    </section>
  );
}
