import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";

import { DocumentToolbar } from "@/components/document-toolbar";
import Image from "next/image";
import { getReceiptByInvoiceToken } from "@/lib/chillbros/billing-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/chillbros/types";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ token: string }> };
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const date = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }) + " CT";
const EXTRA_PAYMENT_LABELS: Record<string, string> = { cash: "Cash", check: "Check", ach: "ACH / Bank Transfer" };

export default async function ReceiptPage({ params }: Props) {
  const { token } = await params;
  const [receipt, staffProfile] = await Promise.all([getReceiptByInvoiceToken(token), getCurrentStaffProfile()]);
  if (!receipt) notFound();
  const rawMethod = receipt.payment_method as string | null;
  const methodLabel = rawMethod ? EXTRA_PAYMENT_LABELS[rawMethod] ?? PAYMENT_METHOD_LABELS[rawMethod as PaymentMethod] ?? rawMethod.replace(/_/g, " ") : "Payment method recorded by manager";
  return <main className="min-h-screen bg-white px-3 py-4 text-zinc-950 sm:px-6 sm:py-8 print:p-0">
    <div className="mx-auto max-w-3xl">
      <DocumentToolbar invoiceNumber={receipt.invoiceNumber} returnHref={staffProfile ? "/invoices" : `/portal/${token}`} backLabel="Back to invoice" homeHref={staffProfile ? "/" : undefined} />
      <article className="overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-xl print:rounded-none print:border-0 print:shadow-none">
        <header className="border-b-4 border-[#1F6FEB] bg-[#05070A] px-6 py-6 text-white"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><Image src="/brand/chill-pros-ice-logo.png" alt="Chill Pros logo" width={900} height={900} className="h-auto w-20 object-contain" /><div><p className="text-2xl font-bold">CHILL PROS</p><p className="text-xs uppercase tracking-[0.24em] text-cyan-100">Payment Receipt</p></div></div><div className="text-right"><p className="text-xs text-cyan-100">RECEIPT</p><p className="mt-1 text-lg font-bold">{receipt.receipt_number}</p></div></div></header>
        <div className="space-y-6 p-6 sm:p-8">
          <section className="grid gap-4 border-b border-zinc-200 pb-5 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Customer</p><p className="mt-1 text-xl font-semibold">{receipt.customerName}</p><p className="mt-1 text-sm text-zinc-600">Invoice {receipt.invoiceNumber}</p></div><div className="sm:text-right"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Paid</p><p className="mt-1 font-semibold">{date(receipt.paid_at)}</p></div></section>
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Payment received</p><p className="mt-2 text-4xl font-black text-emerald-900">{money(Number(receipt.amount))}</p><p className="mt-2 text-sm text-emerald-800">{methodLabel}</p></section>
          <section className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700"><p>This receipt confirms Chill Pros recorded full payment for the invoice shown above. It is not a partial-payment ledger and does not represent multiple installment entries.</p></section>
          <Link href={`/api/portal/${token}/pdf?stage=paid`} target="_blank" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium"><FileDown className="h-4 w-4" />Open immutable paid PDF archive</Link>
        </div>
      </article>
    </div>
  </main>;
}
