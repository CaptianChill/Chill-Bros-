import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getTrackRecord } from "@/lib/chillbros/track-record-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const monthName = (key: string) => new Date(`${key}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) : "—");

export default async function TrackRecordPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");
  const record = await getTrackRecord();
  const growth = record.previous12Collected > 0 ? (record.trailing12Collected - record.previous12Collected) / record.previous12Collected : null;
  const best = Math.max(1, ...record.months.map((m) => m.collected));
  const stats: [string, string, string][] = [
    ["Collected, last 12 months", money.format(record.trailing12Collected), growth === null ? "First year of history" : `${growth >= 0 ? "+" : ""}${(growth * 100).toFixed(0)}% vs the 12 months before`],
    ["Collected, all time", money.format(record.lifetimeCollected), `${record.invoicesPaid} paid invoices since ${day(record.firstActivity)}`],
    ["Average paid ticket", money.format(record.averageTicket), "Collected ÷ paid invoices"],
    ["Paying customers", String(record.customersPaying), `${record.repeatCustomers} came back (${(record.repeatRate * 100).toFixed(0)}% repeat)`],
    ["Service calls completed", String(record.callsCompleted), `${record.callsBooked} booked (cancelled calls not counted)`],
    ["Waiting to be collected", money.format(record.outstandingValue), `${record.outstandingCount} issued invoices unpaid`],
  ];

  return (
    <AppShell
      title="Track Record"
      description="Proof that Chill Pros does the work and gets paid: real collected revenue, completed calls and repeat customers, straight from the job and invoice history."
      highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Proof of income</p><StatusPill tone="emerald">{money.format(record.trailing12Collected)} last 12 months</StatusPill><Link href="/reports/track-record/export" className="block rounded-xl border border-[#2d7dff]/40 bg-[#2d7dff]/15 px-4 py-3 text-center text-sm font-semibold text-white">Download invoice ledger (CSV)</Link></div>}
    >
      <div className="space-y-6">
        <SectionCard eyebrow="The numbers" title="What the business has earned" description="Only paid invoices count as income. Quotes, drafts, voided and replaced documents are left out, and refunds are subtracted.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stats.map(([label, value, detail]) => (
              <div key={label} className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
                <p className="text-sm text-zinc-400">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
                <p className="mt-2 text-sm text-[#bafcfc]">{detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Month by month" title="Last 12 months" description="Money collected in each month (by paid date) and service calls booked that month.">
          <div className="space-y-2">
            {record.months.map((m) => (
              <div key={m.month} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 rounded-xl border border-[#2d7dff]/15 bg-zinc-950/70 px-3 py-2 text-sm">
                <span className="text-zinc-300">{monthName(m.month)}</span>
                <span className="h-2 rounded-full bg-[#2d7dff]/15"><span className="block h-2 rounded-full bg-[#8ffafa]" style={{ width: `${Math.round((m.collected / best) * 100)}%` }} /></span>
                <span className="text-right text-white">{money.format(m.collected)}<span className="block text-xs text-zinc-400">{m.invoicesPaid} paid · {m.callsBooked} calls</span></span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Ledger" title="Every invoice behind these numbers" description="Newest first. The CSV download has the same rows for a lender, accountant or buyer.">
          {record.ledger.length === 0 ? <p className="text-sm text-zinc-400">No issued invoices yet.</p> : (
            <div className="overflow-x-auto rounded-2xl border border-[#2d7dff]/20">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#2d7dff]/10 text-[#d9fbff]"><tr><th className="px-3 py-3">Invoice</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Paid</th><th className="px-3 py-3 text-right">Amount</th></tr></thead>
                <tbody>
                  {record.ledger.slice(0, 200).map((row) => (
                    <tr key={row.id} className="border-t border-[#2d7dff]/10 text-zinc-300">
                      <td className="px-3 py-3 text-white">{row.invoiceNumber}</td>
                      <td className="px-3 py-3">{row.customerName}</td>
                      <td className="px-3 py-3">{row.state === "paid" ? day(row.paidAt) : <span className="text-amber-300">Unpaid</span>}</td>
                      <td className="px-3 py-3 text-right text-[#bafcfc]">{money.format(row.state === "paid" ? row.collected : row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
