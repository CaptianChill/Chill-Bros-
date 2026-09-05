import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, UsersRound, Wrench } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { LiveOfficeRefresh } from "@/components/live-office-refresh";
import { OfficeDocumentActions } from "@/components/office-document-actions";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getWorkflowEvents } from "@/lib/chillbros/invoice-v2";
import { getActiveTechnicians, getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

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
    .limit(12);
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
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Chicago" });
}

export default async function OfficePage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");

  const [jobs, customers, technicians, workflow, invoices] = await Promise.all([
    getDispatchJobs(100),
    getCustomers(),
    getActiveTechnicians(),
    getWorkflowEvents(16),
    getOfficeInvoices(),
  ]);

  const openJobs = jobs.filter((job) => ["scheduled", "in_progress"].includes(job.status));
  const unassignedJobs = openJobs.filter((job) => !job.assignedTechId);
  const inProgressJobs = openJobs.filter((job) => job.status === "in_progress");
  const awaitingApproval = invoices.filter((invoice) => invoice.status === "awaiting_approval").length;
  const approvedUnpaid = invoices.filter((invoice) => invoice.status === "approved" && invoice.paymentStatus !== "paid").length;

  return <AppShell
    title="Dispatch / Office Staff Command Center"
    description="Run customer intake, scheduling, dispatch, CRM, equipment records, customer document delivery, workflow monitoring, and the office workday from one role-specific workspace."
    highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Office status</p><StatusPill tone="emerald">{openJobs.length} open calls</StatusPill><StatusPill>{unassignedJobs.length} unassigned</StatusPill><StatusPill>{awaitingApproval} awaiting approval</StatusPill></div>}
  >
    <LiveOfficeRefresh />
    <div className="space-y-4 sm:space-y-6">
      <SectionCard eyebrow="Today" title="Office operating pulse" description="Live production counts for the items the office should keep moving.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[ ["Open calls", openJobs.length], ["In progress", inProgressJobs.length], ["Unassigned", unassignedJobs.length], ["Awaiting approval", awaitingApproval], ["Approved / unpaid", approvedUnpaid] ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3 text-center"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p></div>)}
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <SectionCard eyebrow="Quick access" title="Office tools" description="Role-approved workspaces only.">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <Link href="/dispatch" className="flex items-center justify-between rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-white"><span className="inline-flex items-center gap-2"><CalendarClock className="h-4 w-4 text-[#8ffafa]" />Dispatch board</span><span className="text-xs text-zinc-500">{openJobs.length} open</span></Link>
            <Link href="/crm" className="flex items-center justify-between rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-white"><span className="inline-flex items-center gap-2"><UsersRound className="h-4 w-4 text-[#8ffafa]" />Customer CRM</span><span className="text-xs text-zinc-500">{customers.length} customers</span></Link>
            <Link href="/equipment" className="flex items-center justify-between rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-white"><span className="inline-flex items-center gap-2"><Wrench className="h-4 w-4 text-[#8ffafa]" />Equipment registry</span><span className="text-xs text-zinc-500">Field records</span></Link>
            <Link href="/timesheet" className="flex items-center justify-between rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-white"><span className="inline-flex items-center gap-2"><CalendarClock className="h-4 w-4 text-[#8ffafa]" />My timesheet</span><span className="text-xs text-zinc-500">Clock / lunch</span></Link>
          </div>
          <div className="mt-4 rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/70 p-4 text-sm text-zinc-400"><p className="font-medium text-white">Active field capacity</p><p className="mt-2">{technicians.length} active technician{technicians.length === 1 ? "" : "s"} available for assignment.</p></div>
        </SectionCard>

        <SectionCard eyebrow="Customer documents" title="Estimate / invoice handoff queue" description="Share the secure customer view without exposing manager-only pricing or payment controls.">
          <div className="space-y-3">{invoices.length === 0 ? <p className="text-sm text-zinc-400">No active estimates or invoices.</p> : invoices.map((invoice) => <div key={invoice.id} className="rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/75 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-white">{invoice.customerName}</p><p className="mt-1 text-xs text-zinc-400">{invoice.invoiceNumber} • updated {centralTime(invoice.updatedAt)}</p></div><StatusPill tone={invoice.paymentStatus === "paid" || invoice.status === "approved" ? "emerald" : "amber"}>{invoice.paymentStatus === "paid" ? "Paid" : invoice.status === "approved" ? "Approved" : "Awaiting approval"}</StatusPill></div><div className="mt-3"><OfficeDocumentActions portalToken={invoice.portalToken} invoiceNumber={invoice.invoiceNumber} customerEmail={invoice.customerEmail} customerPhone={invoice.customerPhone} /></div></div>)}</div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Live handoff" title="Technician → customer → office workflow" description="Latest service, approval, pricing, and payment-state events. This feed refreshes while the office screen is idle.">
        <div className="space-y-2">{workflow.length === 0 ? <p className="text-sm text-zinc-400">No workflow events yet.</p> : workflow.map((entry) => <div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#2d7dff]/10 bg-zinc-950/80 p-3"><div><p className="text-sm text-white">{entry.message}</p><p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#bafcfc]">{entry.stage.replace(/_/g, " ")}</p></div><p className="shrink-0 text-xs text-zinc-500">{centralTime(entry.createdAt)}</p></div>)}</div>
      </SectionCard>
    </div>
  </AppShell>;
}
