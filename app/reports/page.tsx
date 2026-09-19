import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getOperationsReport } from "@/lib/chillbros/report-queries";
import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function ReportsPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");
  const report = await getOperationsReport();
  const metrics = [
    ["Paid revenue", money.format(report.invoices.paidRevenue), `${report.invoices.paid} paid invoices`],
    ["Outstanding", money.format(report.invoices.outstandingValue), `${report.invoices.outstanding} approved unpaid`],
    ["Completed jobs", String(report.jobs.completed), `${report.jobs.inProgress} currently in progress`],
    ["Field hours", (report.time.laborHours + report.time.driveHours).toFixed(1), `${report.time.laborHours.toFixed(1)} labor • ${report.time.driveHours.toFixed(1)} drive`],
    ["Inventory retail", money.format(report.inventory.retailValue), `${report.inventory.units} units on hand`],
    ["Low stock", String(report.inventory.lowStock), `${report.inventory.parts} catalog parts`],
  ];
  return (
    <AppShell title="See revenue, outstanding balances, jobs, technician time, and inventory value from live production data." description="This owner report is intentionally compact: the numbers needed to run the day without turning your service company into an accounting software museum." highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Owner report</p><StatusPill tone="emerald">{money.format(report.invoices.paidRevenue)} paid</StatusPill><StatusPill tone={report.invoices.outstanding > 0 ? "amber" : "emerald"}>{money.format(report.invoices.outstandingValue)} outstanding</StatusPill></div>}>
      <div className="space-y-6">
        <SectionCard eyebrow="Business pulse" title="Core operating numbers" description="Live totals across work, collections, technician time, and stock."><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value, detail]) => <div key={label} className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><p className="text-sm text-zinc-400">{label}</p><p className="mt-2 text-3xl font-semibold text-white">{value}</p><p className="mt-2 text-sm text-[#bafcfc]">{detail}</p></div>)}</div></SectionCard>
        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard eyebrow="Job pipeline" title="Service-call status" description="Current counts across the full job lifecycle."><div className="grid grid-cols-2 gap-3">{[["Scheduled", report.jobs.scheduled],["In progress", report.jobs.inProgress],["Completed", report.jobs.completed],["Cancelled", report.jobs.cancelled]].map(([label, value]) => <div key={label} className="rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/70 p-4"><p className="text-sm text-zinc-400">{label}</p><p className="mt-1 text-2xl font-semibold text-white">{value}</p></div>)}</div></SectionCard>
          <SectionCard eyebrow="Inventory value" title="Stock exposure" description="Current book value using catalog cost and retail prices."><div className="space-y-3"><div className="flex justify-between rounded-xl border border-[#2d7dff]/15 bg-zinc-950/70 p-3"><span className="text-zinc-400">Cost value</span><span className="text-white">{money.format(report.inventory.costValue)}</span></div><div className="flex justify-between rounded-xl border border-[#2d7dff]/15 bg-zinc-950/70 p-3"><span className="text-zinc-400">Retail value</span><span className="text-[#bafcfc]">{money.format(report.inventory.retailValue)}</span></div><div className="flex justify-between rounded-xl border border-[#2d7dff]/15 bg-zinc-950/70 p-3"><span className="text-zinc-400">Low-stock SKUs</span><span className="text-white">{report.inventory.lowStock}</span></div></div></SectionCard>
        </div>
        <SectionCard eyebrow="Collections" title="Active estimate / invoice ledger" description="Recent active customer amounts and collection status.">{report.invoiceRows.length === 0 ? <p className="text-sm text-zinc-400">No estimates or invoices yet.</p> : <div className="overflow-x-auto rounded-2xl border border-[#2d7dff]/20"><table className="min-w-full text-left text-sm"><thead className="bg-[#2d7dff]/10 text-[#d9fbff]"><tr><th className="px-3 py-3">Number</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Payment</th><th className="px-3 py-3 text-right">Total</th></tr></thead><tbody>{report.invoiceRows.map((row) => <tr key={row.id} className="border-t border-[#2d7dff]/10 text-zinc-300"><td className="px-3 py-3 text-white">{row.invoiceNumber}</td><td className="px-3 py-3">{row.customerName}</td><td className="px-3 py-3">{row.status.replace(/_/g, " ")}</td><td className="px-3 py-3">{row.paymentStatus.replace(/_/g, " ")}</td><td className="px-3 py-3 text-right text-[#bafcfc]">{money.format(row.total)}</td></tr>)}</tbody></table></div>}</SectionCard>
      </div>
    </AppShell>
  );
}
