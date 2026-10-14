import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileDown } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getOwnerProfile, getSentInvoiceCopy, STATE_LABEL } from "@/lib/chillbros/sent-invoice-history";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" }) : "—";
}
function stamp(value: string) {
  return new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const SEND_TYPE: Record<string, string> = { invoice: "Invoice", estimate: "Quote", reminder: "Payment reminder", receipt: "Receipt" };

export default async function SentInvoiceCopyPage({ params }: Props) {
  if (!(await getOwnerProfile())) redirect("/");
  const { id } = await params;
  const copy = await getSentInvoiceCopy(id);
  if (!copy) notFound();
  const state = STATE_LABEL[copy.state];
  const label = copy.kind === "quote" ? "Quote" : "Invoice";

  return (
    <AppShell title={`${label} ${copy.invoiceNumber}`} description={`Sent copy for ${copy.customerName}.`}>
      <div className="space-y-4 text-left">
        <Link href="/owner/invoices" className="inline-block text-sm text-zinc-400">← All sent invoices</Link>

        {copy.state === "void" ? <p className="rounded-2xl border border-zinc-500/40 bg-zinc-500/10 p-3 text-sm text-zinc-300">This {label.toLowerCase()} was voided. It&apos;s kept here as a record of what was sent; the customer&apos;s link no longer works.</p> : null}

        <section className="rounded-2xl border border-[#2d7dff]/25 bg-zinc-950/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">{label} · {copy.invoiceNumber}</p>
              <h2 className="mt-1 text-xl font-semibold text-white">{copy.customerName}</h2>
              {copy.customerEmail ? <p className="text-sm text-zinc-400">{copy.customerEmail}</p> : null}
              {copy.customerPhone ? <p className="text-sm text-zinc-400">{copy.customerPhone}</p> : null}
              {copy.jobLocation ? <p className="mt-1 text-sm text-zinc-400">{copy.jobLocation}</p> : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-semibold text-[#bafcfc]">{money.format(copy.total)}</p>
              <div className="mt-1"><StatusPill tone={state.tone}>{state.label}</StatusPill></div>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-zinc-500">Sent</dt><dd className="text-white">{date(copy.firstSentAt)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Due</dt><dd className="text-white">{date(copy.dueAt)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Approved by</dt><dd className="text-white">{copy.signatureName ?? "—"}</dd></div>
            <div><dt className="text-xs text-zinc-500">Paid</dt><dd className="text-white">{copy.paidAt ? date(copy.paidAt) : "—"}{copy.receiptNumber ? ` · ${copy.receiptNumber}` : ""}</dd></div>
          </dl>

          <table className="mt-4 w-full text-sm">
            <thead><tr className="border-b border-[#2d7dff]/20 text-left text-xs text-zinc-500"><th className="py-2 font-medium">Item</th><th className="py-2 text-right font-medium">Qty</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
            <tbody>
              {copy.lineItems.map((item, index) => (
                <tr key={index} className="border-b border-[#2d7dff]/10 align-top">
                  <td className="py-2 pr-2 text-white">{item.label}{item.description ? <span className="block text-xs text-zinc-400">{item.description}</span> : null}</td>
                  <td className="py-2 text-right text-zinc-300">{item.quantity}</td>
                  <td className="py-2 text-right text-white">{money.format(item.amount)}</td>
                </tr>
              ))}
              {!copy.lineItems.length ? <tr><td colSpan={3} className="py-3 text-zinc-400">No line items on file.</td></tr> : null}
            </tbody>
          </table>

          <dl className="ml-auto mt-3 max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-zinc-400">Subtotal</dt><dd className="text-white">{money.format(copy.subtotal)}</dd></div>
            {copy.discountAmount > 0 ? <div className="flex justify-between"><dt className="text-zinc-400">Discount</dt><dd className="text-white">-{money.format(copy.discountAmount)}</dd></div> : null}
            <div className="flex justify-between"><dt className="text-zinc-400">Tax{copy.taxRate ? ` (${copy.taxRate}%)` : ""}</dt><dd className="text-white">{money.format(copy.taxAmount)}</dd></div>
            {copy.creditAmount > 0 ? <div className="flex justify-between"><dt className="text-zinc-400">Credits</dt><dd className="text-white">-{money.format(copy.creditAmount)}</dd></div> : null}
            <div className="flex justify-between border-t border-[#2d7dff]/20 pt-1 font-semibold"><dt className="text-white">Total</dt><dd className="text-[#bafcfc]">{money.format(copy.total)}</dd></div>
            {copy.refundAmount > 0 ? <div className="flex justify-between"><dt className="text-zinc-400">Refunded after</dt><dd className="text-white">{money.format(copy.refundAmount)}</dd></div> : null}
          </dl>

          {copy.notes ? <p className="mt-4 whitespace-pre-wrap rounded-xl border border-[#2d7dff]/10 bg-black/30 p-3 text-sm text-zinc-300">{copy.notes}</p> : null}

          {copy.archiveStages.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {copy.archiveStages.sort().map((stage) => (
                <a key={stage} href={`/owner/invoices/${copy.id}/pdf?stage=${stage}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-sm text-[#d9fbff]">
                  <FileDown className="h-4 w-4" aria-hidden="true" />{stage === "paid" ? "Paid copy (PDF)" : "Approved copy (PDF)"}
                </a>
              ))}
            </div>
          ) : null}
        </section>

        <SectionCard title="Send history">
          {copy.deliveries.length ? (
            <ul className="space-y-2 text-left text-sm">
              {copy.deliveries.map((send, index) => (
                <li key={index} className="flex justify-between gap-3 rounded-xl border border-[#2d7dff]/15 bg-black/30 px-3 py-2">
                  <span className="min-w-0"><span className="text-white">{SEND_TYPE[send.type] ?? send.type}</span> <span className="text-zinc-400">by {send.channel === "sms" ? "text" : "email"} to {send.recipient}</span></span>
                  <span className="shrink-0 text-xs text-zinc-500">{stamp(send.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-zinc-400">Issued {date(copy.issuedAt)}. No email or text send was recorded — it may have been shared by link.</p>}
        </SectionCard>
      </div>
    </AppShell>
  );
}
