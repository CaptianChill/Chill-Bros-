import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote, CalendarDays, Route, UsersRound } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { LiveOfficeRefresh } from "@/components/live-office-refresh";
import { OfficeDocumentActions } from "@/components/office-document-actions";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getActiveTechnicians, getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";
import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";

export const dynamic = "force-dynamic";

type OfficeInvoice = {
  id: string;
  invoiceNumber: string;
  portalToken: string;
  status: "awaiting_approval" | "approved";
  paymentStatus: "unpaid" | "pending_manual_review" | "paid";
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  updatedAt: string;
};

async function getOfficeInvoices(): Promise<OfficeInvoice[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("chillbros_invoices")
    .select("id, invoice_number, portal_token, status, payment_status, updated_at, customer:chillbros_customers(name,email,phone)")
    .in("status", ["awaiting_approval", "approved"])
    .is("revoked_at", null)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return data.map((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      portalToken: row.portal_token,
      status: row.status as OfficeInvoice["status"],
      paymentStatus: row.payment_status as OfficeInvoice["paymentStatus"],
      customerName: customer?.name ?? "Unknown customer",
      customerEmail: customer?.email ?? null,
      customerPhone: customer?.phone ?? null,
      updatedAt: row.updated_at,
    };
  });
}

function centralTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago",
  });
}

function invoiceCard(invoice: OfficeInvoice) {
  return (
    <div key={invoice.id} className="rounded-xl border border-[#2d7dff]/15 bg-zinc-950/75 p-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{invoice.customerName}</p>
          <p className="mt-0.5 truncate text-[11px] text-zinc-400">{invoice.invoiceNumber} • {centralTime(invoice.updatedAt)}</p>
        </div>
        <StatusPill tone={invoice.paymentStatus === "paid" || invoice.status === "approved" ? "emerald" : "amber"}>
          {invoice.paymentStatus === "paid" ? "Paid" : invoice.status === "approved" ? "Approved" : "Awaiting approval"}
        </StatusPill>
      </div>
      <div className="mt-2">
        <OfficeDocumentActions
          portalToken={invoice.portalToken}
          invoiceNumber={invoice.invoiceNumber}
          customerEmail={invoice.customerEmail}
          customerPhone={invoice.customerPhone}
        />
      </div>
    </div>
  );
}

export default async function OfficePage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");

  const [jobs, customers, technicians, invoices] = await Promise.all([
    getDispatchJobs(100),
    getCustomers(),
    getActiveTechnicians(),
    getOfficeInvoices(),
  ]);

  const openJobs = jobs.filter((job) => ["scheduled", "in_progress"].includes(job.status));
  const unassignedJobs = openJobs.filter((job) => !job.assignedTechId);
  const inProgressJobs = openJobs.filter((job) => job.status === "in_progress");
  const awaitingApproval = invoices.filter((invoice) => invoice.status === "awaiting_approval").length;
  const approvedUnpaid = invoices.filter((invoice) => invoice.status === "approved" && invoice.paymentStatus !== "paid").length;
  const visibleInvoices = invoices.slice(0, 5);
  const extraInvoices = invoices.slice(5);

  return (
    <AppShell
      title="Office"
      description="Keep service calls moving from intake to schedule, dispatch, customer record, and billing."
      highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Office status</p><StatusPill tone="emerald">{openJobs.length} open calls</StatusPill><StatusPill>{unassignedJobs.length} unassigned</StatusPill><StatusPill>{awaitingApproval} awaiting approval</StatusPill></div>}
    >
      <LiveOfficeRefresh />
      <div className="space-y-4">
        <SectionCard eyebrow="Today" title="Office operating pulse" description="Only the work that needs to move today stays visible.">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            {[["Open calls", openJobs.length], ["In progress", inProgressJobs.length], ["Unassigned", unassignedJobs.length], ["Awaiting approval", awaitingApproval], ["Approved / unpaid", approvedUnpaid]].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-[#2d7dff]/20 bg-black/40 p-2.5 text-center">
                <p className="text-[11px] text-zinc-500">{label}</p>
                <p className="mt-1 text-xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
          <SectionCard eyebrow="Revenue path" title="Move the service call" description="One small set of screens covers intake through customer billing.">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <Link href="/schedule" className="flex items-center justify-between rounded-xl border border-[#2d7dff]/20 bg-black/40 p-3 text-white"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#8ffafa]" />Schedule</span><span className="text-xs text-zinc-500">Book call</span></Link>
              <Link href="/dispatch" className="flex items-center justify-between rounded-xl border border-[#2d7dff]/20 bg-black/40 p-3 text-white"><span className="inline-flex items-center gap-2"><Route className="h-4 w-4 text-[#8ffafa]" />Dispatch</span><span className="text-xs text-zinc-500">{openJobs.length} open</span></Link>
              <Link href="/customers" className="flex items-center justify-between rounded-xl border border-[#2d7dff]/20 bg-black/40 p-3 text-white"><span className="inline-flex items-center gap-2"><UsersRound className="h-4 w-4 text-[#8ffafa]" />Customers</span><span className="text-xs text-zinc-500">{customers.length}</span></Link>
              <Link href="/invoices" className="flex items-center justify-between rounded-xl border border-[#2d7dff]/20 bg-black/40 p-3 text-white"><span className="inline-flex items-center gap-2"><Banknote className="h-4 w-4 text-[#8ffafa]" />Quotes & invoices</span><span className="text-xs text-zinc-500">Bill work</span></Link>
            </div>
            <div className="mt-3 rounded-xl border border-[#2d7dff]/15 bg-zinc-950/70 p-3 text-sm text-zinc-400"><span className="font-medium text-white">{technicians.length}</span> active technician{technicians.length === 1 ? "" : "s"} available.</div>
          </SectionCard>

          <SectionCard eyebrow="Customer documents" title="Estimate / invoice handoff queue" description="Five newest items stay visible. Older active documents remain in Billing.">
            {invoices.length === 0 ? (
              <p className="text-sm text-zinc-400">No active estimates or invoices.</p>
            ) : (
              <div className="space-y-2">
                {visibleInvoices.map(invoiceCard)}
                {extraInvoices.length > 0 ? (
                  <details className="rounded-xl border border-[#2d7dff]/20 bg-black/35">
                    <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-[#d9fbff]">
                      Show {extraInvoices.length} more active document{extraInvoices.length === 1 ? "" : "s"}
                    </summary>
                    <div className="space-y-2 border-t border-[#2d7dff]/15 p-2">{extraInvoices.map(invoiceCard)}</div>
                  </details>
                ) : null}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
