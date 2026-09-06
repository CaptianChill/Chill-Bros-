"use client";

import { useState, useTransition } from "react";
import { Archive, Mail, MessageSquareText, RefreshCw, ReceiptText, Send, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { ensureInvoiceArchiveAction, recordInvoiceAdjustmentAction, sendInvoiceCommunicationAction, updateInvoiceBillingSettingsAction } from "@/lib/chillbros/billing-actions";
import { markInvoicePaidV2Action } from "@/lib/chillbros/estimate-actions-v2";
import { revokeEstimateAction } from "@/lib/chillbros/mutations";
import type { InvoiceAdjustmentType, InvoiceStatus, PaymentStatus, PaymentTerms } from "@/lib/chillbros/types";

type Props = {
  invoiceId: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  taxRate: number;
  paymentTerms: PaymentTerms;
  dueAt: string | null;
  taxExempt: boolean;
  taxExemptNote: string | null;
  hasApprovedArchive: boolean;
  hasPaidArchive: boolean;
  canManage: boolean;
};

function inputDate(value: string | null) { return value ? new Date(value).toISOString().slice(0, 10) : ""; }

export function InvoiceAdminControls(props: Props) {
  const router = useRouter();
  const [taxRate, setTaxRate] = useState(String(props.taxRate));
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>(props.paymentTerms);
  const [dueDate, setDueDate] = useState(inputDate(props.dueAt));
  const [taxExempt, setTaxExempt] = useState(props.taxExempt);
  const [taxExemptNote, setTaxExemptNote] = useState(props.taxExemptNote ?? "");
  const [adjustmentType, setAdjustmentType] = useState<InvoiceAdjustmentType>(props.paymentStatus === "paid" ? "refund" : "credit");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const taxLocked = props.status === "approved";

  const run = (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setMessage(null); setError(null);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) { setError(result.error ?? "Action failed."); return; }
      setMessage(success);
      router.refresh();
    });
  };

  const send = (channel: "email" | "sms", reminder = false) => run(async () => {
    const result = await sendInvoiceCommunicationAction(props.invoiceId, channel, reminder);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }, reminder ? `Reminder sent by ${channel}.` : `${channel === "email" ? "Email" : "Text"} sent.`);

  return <div className="space-y-3">
    {message ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{message}</p> : null}
    {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p> : null}

    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pending} onClick={() => send("email")} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff] disabled:opacity-40"><Mail className="h-3.5 w-3.5" />Send email</button>
      <button type="button" disabled={pending} onClick={() => send("sms")} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff] disabled:opacity-40"><MessageSquareText className="h-3.5 w-3.5" />Send text</button>
      {props.status === "approved" && props.paymentStatus !== "paid" ? <button type="button" disabled={pending} onClick={() => send("email", true)} className="inline-flex items-center gap-2 rounded-xl border border-amber-400/25 px-3 py-2 text-xs text-amber-100 disabled:opacity-40"><Send className="h-3.5 w-3.5" />Email reminder</button> : null}
      {props.status === "approved" && !props.hasApprovedArchive ? <button type="button" disabled={pending} onClick={() => run(async () => { const result = await ensureInvoiceArchiveAction(props.invoiceId, "approved"); return result.ok ? { ok: true } : { ok: false, error: result.error }; }, "Approved PDF archive created.")} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-[#d9fbff] disabled:opacity-40"><Archive className="h-3.5 w-3.5" />Build approved PDF</button> : null}
      {props.paymentStatus === "paid" && !props.hasPaidArchive ? <button type="button" disabled={pending} onClick={() => run(async () => { const result = await ensureInvoiceArchiveAction(props.invoiceId, "paid"); return result.ok ? { ok: true } : { ok: false, error: result.error }; }, "Paid PDF archive created.")} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 px-3 py-2 text-xs text-emerald-100 disabled:opacity-40"><ReceiptText className="h-3.5 w-3.5" />Build paid PDF</button> : null}
    </div>

    {props.canManage ? <details className="rounded-2xl border border-[#2d7dff]/15 bg-black/35 p-3">
      <summary className="cursor-pointer text-sm font-medium text-white">Manager billing controls</summary>
      <div className="mt-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs text-zinc-400">Tax rate %<input type="number" min="0" max="25" step="0.001" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} disabled={taxLocked || pending} className="mt-1 w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white disabled:opacity-45" /></label>
          <label className="text-xs text-zinc-400">Payment terms<select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value as PaymentTerms)} disabled={pending} className="mt-1 w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white"><option value="due_on_receipt">Due on receipt</option><option value="net_7">Net 7</option><option value="net_15">Net 15</option><option value="net_30">Net 30</option><option value="custom">Custom</option></select></label>
          <label className="text-xs text-zinc-400">Due date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={pending || paymentTerms !== "custom"} className="mt-1 w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white disabled:opacity-45" /></label>
          <label className="mt-5 inline-flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={taxExempt} onChange={(e) => setTaxExempt(e.target.checked)} disabled={taxLocked || pending} className="h-4 w-4" />Customer tax exempt</label>
        </div>
        <label className="block text-xs text-zinc-400">Tax-exempt note<input value={taxExemptNote} onChange={(e) => setTaxExemptNote(e.target.value)} maxLength={500} disabled={taxLocked || pending || !taxExempt} placeholder="Certificate / exemption note" className="mt-1 w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white disabled:opacity-45" /></label>
        {taxLocked ? <p className="text-xs text-amber-100">Tax is locked because the customer already approved this invoice. Use a credit/refund adjustment rather than altering the signed pricing.</p> : null}
        <button type="button" disabled={pending} onClick={() => run(async () => { const result = await updateInvoiceBillingSettingsAction(props.invoiceId, { taxRate: Number(taxRate || 0), paymentTerms, dueDate: dueDate || null, taxExempt, taxExemptNote }); return result.ok ? { ok: true } : { ok: false, error: result.error }; }, "Billing settings saved.")} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/35 px-3 py-2 text-xs text-[#d9fbff] disabled:opacity-40"><ShieldCheck className="h-3.5 w-3.5" />Save billing settings</button>

        <div className="border-t border-[#2d7dff]/15 pt-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">Audited credit / refund</p>
          <div className="mt-2 grid gap-2 md:grid-cols-[130px_130px_1fr_auto]"><select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value as InvoiceAdjustmentType)} disabled={pending} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white"><option value="credit">Credit</option><option value="refund">Refund</option></select><input type="number" min="0.01" step="0.01" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(e.target.value)} placeholder="$ amount" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white" /><input value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} maxLength={1000} placeholder="Reason / authorization note" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-sm text-white" /><button type="button" disabled={pending || !adjustmentAmount || adjustmentReason.trim().length < 2} onClick={() => run(async () => { const result = await recordInvoiceAdjustmentAction(props.invoiceId, adjustmentType, Number(adjustmentAmount), adjustmentReason); return result.ok ? { ok: true } : { ok: false, error: result.error }; }, `${adjustmentType === "credit" ? "Credit" : "Refund"} recorded.`)} className="rounded-xl border border-amber-400/25 px-3 py-2 text-xs text-amber-100 disabled:opacity-40">Record</button></div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[#2d7dff]/15 pt-4">
          {props.status === "approved" && props.paymentStatus !== "paid" ? <button type="button" disabled={pending} onClick={() => run(async () => { const result = await markInvoicePaidV2Action(props.invoiceId); return result.ok ? { ok: true } : { ok: false, error: result.error }; }, "Full payment recorded and receipt created.")} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 px-3 py-2 text-xs text-emerald-100 disabled:opacity-40"><ReceiptText className="h-3.5 w-3.5" />Mark full invoice paid</button> : null}
          {props.status !== "void" && props.paymentStatus !== "paid" ? <button type="button" disabled={pending} onClick={() => run(async () => { const result = await revokeEstimateAction(props.invoiceId); return result.ok ? { ok: true } : { ok: false, error: result.error }; }, "Invoice voided with audit trail.")} className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 px-3 py-2 text-xs text-rose-200 disabled:opacity-40"><RefreshCw className="h-3.5 w-3.5" />Void invoice</button> : null}
        </div>
      </div>
    </details> : null}
  </div>;
}
