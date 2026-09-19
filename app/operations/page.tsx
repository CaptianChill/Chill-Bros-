import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { getCalendarJobs } from "@/lib/chillbros/schedule-queries";
import { getCustomers, getDashboardMetrics, getEmailLog, getPartsCatalog } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ view?: string }> };

const actionClass = "inline-flex min-h-10 items-center justify-center rounded-xl border border-[#8ffafa]/35 bg-[#2d7dff]/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#2d7dff]/20";

export default async function OperationsPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");
  const params = await searchParams;
  const view = params.view ?? "dispatch";

  const [metrics, jobs, customers, parts, communications] = await Promise.all([
    getDashboardMetrics(),
    getCalendarJobs(),
    getCustomers(),
    getPartsCatalog(),
    getEmailLog(30),
  ]);

  const lowStock = parts.filter((part) => part.stock < 5);
  const tabs = [
    { key: "dispatch", label: "Open dispatch", count: metrics.openJobs },
    { key: "approvals", label: "Approvals", count: metrics.approvalsToday },
    { key: "inventory", label: "Inventory alerts", count: metrics.lowStockParts },
    { key: "communications", label: "Communications", count: metrics.emailEventsToday },
    { key: "customers", label: "Customers", count: customers.length },
  ];

  return (
    <AppShell title="Operational Pulse Review" description="Open any category, review the live records behind the dashboard count, and jump straight to the page where that category can be adjusted.">
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {tabs.map((tab) => (
            <Link key={tab.key} href={`/operations?view=${tab.key}`} className={`rounded-2xl border p-4 transition ${view === tab.key ? "border-[#8ffafa]/55 bg-[#2d7dff]/15" : "border-[#2d7dff]/25 bg-black/40 hover:border-[#8ffafa]/35"}`}>
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">{tab.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{tab.count}</p>
              <p className="mt-2 text-xs text-[#bafcfc]">Open details</p>
            </Link>
          ))}
        </div>

        {view === "dispatch" ? (
          <SectionCard eyebrow="Dispatch" title="Open and scheduled service calls" description="Review saved calls, technician assignments, locations, and schedule windows.">
            <div className="mb-4 flex flex-wrap gap-2"><Link href="/schedule" className={actionClass}>Adjust Schedule</Link><Link href="/dispatch" className={actionClass}>Open Dispatch</Link></div>
            <div className="grid gap-3">
              {jobs.length === 0 ? <p className="text-sm text-zinc-400">No scheduled or in-progress calls.</p> : jobs.map((job) => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-4 transition hover:border-[#8ffafa]/35">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-white">{job.customerName}</p><p className="mt-1 text-sm text-zinc-400">{job.location ?? "No location"}</p></div><p className="text-xs text-[#bafcfc]">{job.scheduledWindow ?? "No schedule"}</p></div>
                  <p className="mt-2 text-xs text-zinc-500">{job.assignedTechName ?? "Unassigned"} · {job.status.replace(/_/g, " ")}</p>
                </Link>
              ))}
            </div>
          </SectionCard>
        ) : null}

        {view === "approvals" ? (
          <SectionCard eyebrow="Approvals" title="Customer approvals and billing review" description="The pulse count tracks approvals recorded today. Use the billing workspace to review, revise, resend, or follow up.">
            <div className="flex flex-wrap gap-2"><Link href="/invoices" className={actionClass}>Review Invoices & Quotes</Link><Link href="/create" className={actionClass}>Create / Adjust Document</Link></div>
            <p className="mt-4 rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-4 text-sm text-zinc-300">Approved today: <strong className="text-white">{metrics.approvalsToday}</strong>. Open the invoice workspace for the individual approval records and customer document controls.</p>
          </SectionCard>
        ) : null}

        {view === "inventory" ? (
          <SectionCard eyebrow="Inventory" title="Low-stock parts" description="Every item below five units is shown here. Open Inventory to change stock, pricing, or part details.">
            <div className="mb-4"><Link href="/inventory" className={actionClass}>Adjust Inventory</Link></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lowStock.length === 0 ? <p className="text-sm text-zinc-400">No low-stock parts.</p> : lowStock.map((part) => (
                <Link key={part.id} href="/inventory" className="rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-4 transition hover:border-[#8ffafa]/35"><p className="font-semibold text-white">{part.name}</p><p className="mt-1 text-xs text-zinc-500">{part.partNumber}</p><p className="mt-3 text-sm text-[#bafcfc]">Stock: {part.stock}</p></Link>
              ))}
            </div>
          </SectionCard>
        ) : null}

        {view === "communications" ? (
          <SectionCard eyebrow="Communications" title="Recent communication workflow" description="Review recent customer approval and payment communication events.">
            <div className="mb-4"><Link href="/invoices" className={actionClass}>Open Customer Documents</Link></div>
            <div className="grid gap-3">{communications.length === 0 ? <p className="text-sm text-zinc-400">No communication events.</p> : communications.map((entry) => <div key={entry.id} className="rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-4"><p className="font-semibold text-white">{entry.subject}</p><p className="mt-1 text-xs text-zinc-500">{entry.recipients}</p><p className="mt-2 text-xs text-[#bafcfc]">{entry.status} · {new Date(entry.createdAt).toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</p></div>)}</div>
          </SectionCard>
        ) : null}

        {view === "customers" ? (
          <SectionCard eyebrow="Customers" title="Customer records" description="Open a customer to review service history, jobs, documents, and saved contact information.">
            <div className="mb-4"><Link href="/customers" className={actionClass}>Open Customer Center</Link></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{customers.map((customer) => <Link key={customer.id} href={`/customers/${customer.id}`} className="rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-4 transition hover:border-[#8ffafa]/35"><p className="font-semibold text-white">{customer.name}</p><p className="mt-2 text-sm text-zinc-400">{customer.address ?? "No address"}</p><p className="mt-2 text-xs text-[#bafcfc]">Review customer</p></Link>)}</div>
          </SectionCard>
        ) : null}
      </div>
    </AppShell>
  );
}
