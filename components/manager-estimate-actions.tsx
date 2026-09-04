"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BadgeDollarSign, Ban, Copy, ExternalLink, FileText, Mail, MessageSquareText } from "lucide-react";
import { useRouter } from "next/navigation";

import { markInvoicePaidV2Action } from "@/lib/chillbros/estimate-actions-v2";
import { revokeEstimateAction } from "@/lib/chillbros/mutations";
import type { InvoiceStatus, PaymentStatus } from "@/lib/chillbros/types";

export function ManagerEstimateActions({ invoiceId, portalToken, invoiceNumber, customerEmail, customerPhone, status, paymentStatus }: { invoiceId: string; portalToken: string; invoiceNumber: string; customerEmail: string | null; customerPhone: string | null; status: InvoiceStatus; paymentStatus: PaymentStatus }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const getPortalUrl = () => `${window.location.origin}/portal/${portalToken}`;
  const markPaid = () => { setMessage(null); setError(null); startTransition(async () => { const result = await markInvoicePaidV2Action(invoiceId); if (!result.ok) { setError(result.error); return; } setMessage("Payment recorded. Dispatch and workflow status updated."); router.refresh(); }); };
  const revoke = () => { setMessage(null); setError(null); startTransition(async () => { const result = await revokeEstimateAction(invoiceId); if (!result.ok) { setError(result.error); return; } setMessage("Estimate revoked. Customer link invalidated."); router.refresh(); }); };
  const copyLink = async () => { setError(null); try { await navigator.clipboard.writeText(getPortalUrl()); setMessage("Secure customer link copied."); } catch { setError("Could not copy the link on this device."); } };
  const emailCustomer = () => { if (!customerEmail) return; window.location.href = `mailto:${encodeURIComponent(customerEmail)}?subject=${encodeURIComponent(`Chill Bros ${invoiceNumber}`)}&body=${encodeURIComponent(`Review your Chill Bros estimate/invoice here: ${getPortalUrl()}`)}`; };
  const textCustomer = () => { if (!customerPhone) return; window.location.href = `sms:${customerPhone.replace(/[^+\d]/g, "")}?&body=${encodeURIComponent(`Chill Bros ${invoiceNumber}: ${getPortalUrl()}`)}`; };

  return <div className="mt-3 space-y-2">{error ? <p className="text-xs text-rose-300">{error}</p> : null}{message ? <p className="text-xs text-emerald-300">{message}</p> : null}<div className="flex flex-wrap gap-2">
    <Link href={`/portal/${portalToken}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><ExternalLink className="h-3.5 w-3.5" />Open client</Link>
    <Link href={`/portal/${portalToken}/document`} target="_blank" className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><FileText className="h-3.5 w-3.5" />Document</Link>
    <button type="button" onClick={copyLink} disabled={pending} className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff] disabled:opacity-50"><Copy className="h-3.5 w-3.5" />Copy link</button>
    {customerEmail ? <button type="button" onClick={emailCustomer} className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><Mail className="h-3.5 w-3.5" />Email</button> : null}
    {customerPhone ? <button type="button" onClick={textCustomer} className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><MessageSquareText className="h-3.5 w-3.5" />Text</button> : null}
    <button type="button" onClick={markPaid} disabled={pending || status !== "approved" || paymentStatus === "paid"} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 px-3 py-2 text-xs text-emerald-200 disabled:opacity-35"><BadgeDollarSign className="h-3.5 w-3.5" />{paymentStatus === "paid" ? "Paid" : "Mark paid"}</button>
    <button type="button" onClick={revoke} disabled={pending || paymentStatus === "paid" || status === "void"} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 px-3 py-2 text-xs text-rose-200 disabled:opacity-35"><Ban className="h-3.5 w-3.5" />Revoke</button>
  </div></div>;
}
