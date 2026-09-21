import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, HandCoins, ReceiptText, WalletCards } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { getInvoiceCenterData } from "@/lib/chillbros/billing-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { recordDownPaymentAction, recordFullPaymentAction } from "@/app/payments/actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ tab?: string; invoice?: string; success?: string; error?: string }> };
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

const METHODS = [
  ["cash", "Cash"],
  ["check", "Check"],
  ["ach", "ACH / Bank Transfer"],
  ["cash_app", "Cash App"],
  ["venmo", "Venmo"],
  ["zelle", "Zelle"],
  ["apple_pay", "Apple Pay"],
  ["card", "Credit / Debit Card"],
] as const;

const DOWN_PAYMENT_METHODS = [...METHODS, ["chime", "Chime"] as const];

export default async function PaymentsPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in?next=%2Fpayments");
  if (profile.role !== "manager") redirect("/");

  const params = await searchParams;
  const tab = params.tab === "down" ? "down" : "full";
  const { rows } = await getInvoiceCenterData();
  const approved = rows.filter((row) => row.status === "approved");
  const unpaid = approved.filter((row) => row.paymentStatus !== "paid");
  const needsDownPayment = approved.filter((row) => row.downPaymentAmount > 0 && row.downPaymentStatus !== "paid");

  const tabLink = (value: string) => `/payments?tab=${value}`;
  const tabClass = (value: string) => `inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold ${tab === value ? "border-[#8ffafa]/60 bg-[#2d7dff]/20 text-white" : "border-[#2d7dff]/25 text-[#d9fbff]"}`;

  return <AppShell
    title="Payment Center"
    description="Record full invoice payments and quote down payments from one manager-only form."
    highlight={<div className="space-y-2"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Payments</p><StatusPill tone="emerald">Manager only</StatusPill><StatusPill>{unpaid.length} unpaid approved</StatusPill>{needsDownPayment.length ? <StatusPill tone="amber">{needsDownPayment.length} down payment due</StatusPill> : null}</div>}
  >
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Link href={tabLink("full")} className={tabClass("full")}><WalletCards className="h-4 w-4" />Full payments</Link>
        <Link href={tabLink("down")} className={tabClass("down")}><HandCoins className="h-4 w-4" />Down payments{needsDownPayment.length ? ` (${needsDownPayment.length})` : ""}</Link>
      </div>

      {params.error ? <p className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{params.error}</p> : null}
      {params.success ? <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{params.success}</p> : null}

      {tab === "full" ? <FullPaymentTab rows={approved} selectedId={params.invoice} /> : <DownPaymentTab rows={needsDownPayment} selectedId={params.invoice} />}
    </div>
  </AppShell>;
}

function FullPaymentTab({ rows, selectedId }: { rows: Awaited<ReturnType<typeof getInvoiceCenterData>>["rows"]; selectedId?: string }) {
  const selected = rows.find((row) => row.id === selectedId) ?? rows.find((row) => row.paymentStatus !== "paid") ?? rows[0] ?? null;

  return <>
    <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/35 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3"><WalletCards className="h-5 w-5 text-[#8ffafa]" /><div><h2 className="text-xl font-semibold text-white">Select invoice</h2><p className="text-sm text-zinc-400">Only approved invoices can be recorded as paid.</p></div></div>
      <form action="/payments" method="get" className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <select name="invoice" defaultValue={selected?.id ?? ""} className="min-h-12 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white">
          <option value="">Choose invoice</option>
          {rows.map((row) => <option key={row.id} value={row.id}>{row.invoiceNumber} • {row.customerName} • {money(row.total)} • {row.paymentStatus === "paid" ? "PAID" : "UNPAID"}</option>)}
        </select>
        <button type="submit" className="min-h-12 rounded-2xl border border-[#2d7dff]/40 bg-[#2d7dff]/10 px-4 py-3 text-sm font-medium text-[#d9fbff]">Load invoice</button>
      </form>
    </section>

    {!selected ? <section className="rounded-3xl border border-[#2d7dff]/20 bg-black/35 p-6 text-sm text-zinc-400">No approved invoices are available yet.</section> : selected.paymentStatus === "paid" ? (
      <section className="space-y-4 rounded-3xl border border-emerald-500/25 bg-emerald-500/5 p-5">
        <div className="flex items-center gap-3"><ReceiptText className="h-5 w-5 text-emerald-300" /><div><h2 className="text-xl font-semibold text-white">Invoice already paid</h2><p className="text-sm text-zinc-400">{selected.invoiceNumber} • {selected.customerName} • {money(selected.total)}</p></div></div>
        <div className="grid gap-2 sm:grid-cols-2"><Link href={`/portal/${selected.portalToken}/receipt`} target="_blank" className="min-h-12 rounded-2xl border border-emerald-500/25 px-4 py-3 text-center text-sm text-emerald-100">Open receipt</Link><Link href={`/portal/${selected.portalToken}`} target="_blank" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-white">Open invoice</Link></div>
      </section>
    ) : (
      <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/35 p-4 sm:p-5">
        <div className="mb-5"><h2 className="text-xl font-semibold text-white">Record full payment</h2><p className="mt-1 text-sm text-zinc-400">{selected.invoiceNumber} • {selected.customerName} • <span className="font-semibold text-[#8ffafa]">{money(selected.total)}</span></p></div>
        <form action={recordFullPaymentAction} className="space-y-4">
          <input type="hidden" name="invoiceId" value={selected.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm text-zinc-300"><span>Payment method</span><select required name="method" defaultValue="card" className="min-h-12 w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white">{METHODS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="space-y-1.5 text-sm text-zinc-300"><span>Paid date / time</span><input name="paidAt" type="datetime-local" className="min-h-12 w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /></label>
            <label className="space-y-1.5 text-sm text-zinc-300"><span>Payer name</span><input name="payerName" placeholder="Customer or business name" className="min-h-12 w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /></label>
            <label className="space-y-1.5 text-sm text-zinc-300"><span>Confirmation / check / transaction #</span><input name="reference" placeholder="Optional reference" className="min-h-12 w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /></label>
            <label className="space-y-1.5 text-sm text-zinc-300"><span>Card last 4 only</span><input name="cardLast4" inputMode="numeric" maxLength={4} placeholder="1234" className="min-h-12 w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /></label>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-100"><CreditCard className="mb-1 h-4 w-4" />Do not enter a full card number, CVV, routing number, or bank account number here. Use your processor/terminal and record only the confirmation details.</div>
          </div>
          <label className="block space-y-1.5 text-sm text-zinc-300"><span>Payment notes</span><textarea name="notes" rows={4} placeholder="Optional internal payment note" className="w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /></label>
          <button type="submit" className="min-h-12 w-full rounded-2xl border border-emerald-400/50 bg-emerald-500/10 px-4 py-3 font-semibold text-emerald-100">Record full payment & generate receipt</button>
        </form>
        <p className="mt-3 text-xs leading-5 text-zinc-500">This remains a full-payment workflow only. It does not create an open partial-payment ledger — a quote-stage down payment is tracked separately, on the Down payments tab.</p>
      </section>
    )}
  </>;
}

function DownPaymentTab({ rows, selectedId }: { rows: Awaited<ReturnType<typeof getInvoiceCenterData>>["rows"]; selectedId?: string }) {
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  return <>
    <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/35 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3"><HandCoins className="h-5 w-5 text-[#8ffafa]" /><div><h2 className="text-xl font-semibold text-white">Select quote</h2><p className="text-sm text-zinc-400">Only approved quotes with an unpaid required down payment are listed.</p></div></div>
      {rows.length === 0 ? <p className="rounded-2xl border border-[#2d7dff]/15 bg-black/40 p-4 text-sm text-zinc-400">No quotes are currently waiting on a down payment.</p> : <form action="/payments" method="get" className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input type="hidden" name="tab" value="down" />
        <select name="invoice" defaultValue={selected?.id ?? ""} className="min-h-12 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white">
          <option value="">Choose quote</option>
          {rows.map((row) => <option key={row.id} value={row.id}>{row.invoiceNumber} • {row.customerName} • Down payment {money(row.downPaymentAmount)}{row.downPaymentStatus === "pending_manual_review" ? " • customer selected a method" : ""}</option>)}
        </select>
        <button type="submit" className="min-h-12 rounded-2xl border border-[#2d7dff]/40 bg-[#2d7dff]/10 px-4 py-3 text-sm font-medium text-[#d9fbff]">Load quote</button>
      </form>}
    </section>

    {selected ? <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/35 p-4 sm:p-5">
      <div className="mb-5"><h2 className="text-xl font-semibold text-white">Record down payment</h2><p className="mt-1 text-sm text-zinc-400">{selected.invoiceNumber} • {selected.customerName} • <span className="font-semibold text-[#8ffafa]">{money(selected.downPaymentAmount)}</span> due upfront{selected.downPaymentStatus === "pending_manual_review" ? " (customer already told us how they're paying)" : ""}</p></div>
      <form action={recordDownPaymentAction} className="space-y-4">
        <input type="hidden" name="invoiceId" value={selected.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm text-zinc-300"><span>Payment method</span><select required name="method" defaultValue="card" className="min-h-12 w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white">{DOWN_PAYMENT_METHODS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="space-y-1.5 text-sm text-zinc-300"><span>Paid date / time</span><input name="paidAt" type="datetime-local" className="min-h-12 w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /></label>
          <label className="space-y-1.5 text-sm text-zinc-300 sm:col-span-2"><span>Confirmation / transaction #</span><input name="reference" placeholder="Optional reference" className="min-h-12 w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /></label>
        </div>
        <button type="submit" className="min-h-12 w-full rounded-2xl border border-emerald-400/50 bg-emerald-500/10 px-4 py-3 font-semibold text-emerald-100">Record down payment</button>
      </form>
      <p className="mt-3 text-xs leading-5 text-zinc-500">This amount is subtracted from the final invoice total once the job is issued for billing. It does not itself generate a customer receipt — the receipt still comes from the final payment.</p>
    </section> : null}
  </>;
}
