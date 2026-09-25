"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, Lock, Receipt } from "lucide-react";

import { downscaleImage } from "@/lib/chillbros/client-image";
import { setReceiptShowOnInvoiceAction, uploadJobReceiptAction } from "@/lib/chillbros/work-page-actions";

type JobReceipt = { id: string; vendor: string | null; amount: number | null; note: string | null; createdAt: string; createdByName: string | null; showOnInvoice: boolean; url: string | null; isPdf: boolean };

const field = "mt-1 min-h-11 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 text-base font-medium text-[#0A1A33] placeholder:text-[#5B6B82]";
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const when = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Supply-house receipts for job costing. Staff only — never on the customer's portal, PDF or email. */
export function ReceiptsSection({ jobId, receipts, canAdd, canToggleInvoice }: { jobId: string; receipts: JobReceipt[]; canAdd: boolean; canToggleInvoice: boolean }) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) return setError("Take or choose a receipt photo first.");
    setError(null);
    setMessage(null);
    startTransition(async () => {
      data.set("file", await downscaleImage(file));
      const result = await uploadJobReceiptAction(data);
      if (!result.ok) return setError(result.error);
      form.reset();
      setFileName(null);
      setMessage("Receipt saved.");
      router.refresh();
    });
  };

  const toggle = (receipt: JobReceipt) =>
    startTransition(async () => {
      const result = await setReceiptShowOnInvoiceAction(receipt.id, !receipt.showOnInvoice);
      if (!result.ok) setError(result.error);
      router.refresh();
    });

  return (
    <details className="cb-work-card group" id="receipts">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-lg font-bold"><Receipt className="h-5 w-5 text-[#1557B0]" aria-hidden="true" />Receipts ({receipts.length})</span>
          <span className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[#8A4B00]"><Lock className="h-3.5 w-3.5" aria-hidden="true" />Internal — not shown to customer</span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-3 border-t border-[#0A1A33]/10 px-3.5 py-3">
        {receipts.length ? (
          <ul className="space-y-2">
            {receipts.map((receipt) => (
              <li key={receipt.id} className="flex items-start gap-3 rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] p-2.5">
                {receipt.url ? (
                  <a href={receipt.url} target="_blank" rel="noreferrer" className="block h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#C7D3E2] bg-white" aria-label="Open receipt">
                    {receipt.isPdf ? (
                      <FileText className="m-auto mt-3 h-8 w-8 text-[#1557B0]" aria-hidden="true" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from the private bucket
                      <img src={receipt.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </a>
                ) : null}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-bold">{receipt.vendor || "Receipt"}{receipt.amount !== null ? ` · ${money(receipt.amount)}` : ""}</p>
                  {receipt.note ? <p className="font-medium text-[#2B3F5C]">{receipt.note}</p> : null}
                  <p className="text-[12px] font-medium text-[#5B6B82]">{when(receipt.createdAt)}{receipt.createdByName ? ` · ${receipt.createdByName}` : ""}</p>
                  {canToggleInvoice ? (
                    <label className="mt-1 inline-flex min-h-11 items-center gap-2 font-semibold">
                      <input type="checkbox" checked={receipt.showOnInvoice} onChange={() => toggle(receipt)} disabled={pending} className="h-5 w-5" />
                      Office: mark for invoice
                    </label>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-medium text-[#2B3F5C]">No receipts on this job.</p>
        )}
        {canAdd ? (
          <form data-no-draft onSubmit={submit} className="grid grid-cols-2 gap-2">
            <input type="hidden" name="jobId" value={jobId} />
            <label className="col-span-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#1557B0] bg-[#F8FAFD] px-3 text-center font-semibold text-[#1557B0]">
              <Receipt className="h-5 w-5" aria-hidden="true" />
              <span className="truncate">{fileName ?? "Take / upload receipt"}</span>
              <input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)} />
            </label>
            <label className="col-span-2 text-sm font-semibold">Vendor<input name="vendor" maxLength={200} placeholder="e.g. Johnstone Supply" className={field} /></label>
            <label className="text-sm font-semibold">Amount<input name="amount" inputMode="decimal" placeholder="$0.00" className={field} /></label>
            <label className="text-sm font-semibold">Note<input name="note" maxLength={1000} placeholder="What it was for" className={field} /></label>
            <button type="submit" disabled={pending} className="col-span-2 min-h-12 rounded-xl bg-[#1557B0] font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : "Save receipt"}</button>
          </form>
        ) : null}
        {error ? <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p> : null}
        {message ? <p role="status" className="text-sm font-semibold text-[#0A7FC2]">{message}</p> : null}
      </div>
    </details>
  );
}
