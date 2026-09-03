import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ManagerEstimateActions } from "@/components/manager-estimate-actions";
import { ManagerUserPanel } from "@/components/manager-user-panel";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { PAYMENT_METHOD_LABELS, type InvoiceStatus, type PaymentMethod, type PaymentStatus } from "@/lib/chillbros/types";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { getEmailLog, getFeeSettings, getStaffAccounts } from "@/lib/chillbros/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

type AwaitingApprovalInvoice = {
  id: string;
  invoiceNumber: string;
  portalToken: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
};

async function getAwaitingApprovalInvoices(): Promise<AwaitingApprovalInvoice[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("chillbros_invoices")
    .select("id, invoice_number, portal_token, status, payment_status, payment_method, customer:chillbros_customers(name,email,phone)")
    .in("status", ["awaiting_approval", "approved"])
    .is("revoked_at", null)
    .order("updated_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    return { id: row.id, invoiceNumber: row.invoice_number, portalToken: row.portal_token, status: row.status, paymentStatus: row.payment_status, paymentMethod: row.payment_method, customerName: customer?.name ?? "Unknown customer", customerEmail: customer?.email ?? null, customerPhone: customer?.phone ?? null };
  });
}

export default async function ManagerPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");
  const [accounts, feeSettings, emailLog, invoices] = await Promise.all([getStaffAccounts(), getFeeSettings(), getEmailLog(6), getAwaitingApprovalInvoices()]);

  return (
    <AppShell title="Manager controls for staff, pricing, approvals, customer sharing, and audited payments." description="Approve the office workflow from one place: technician credentials, baseline fees, active estimates, customer link sharing, payment recording, revocation, and communication history." highlight={<div className="space-y-4"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Manager highlights</p><div className="space-y-3"><StatusPill tone="emerald">Technician credential control</StatusPill><StatusPill>Estimate approval queue</StatusPill><StatusPill>Audited payment controls</StatusPill></div></div>}>
      <div className="space-y-6">
        <SectionCard eyebrow="User control panel" title="Staff accounts" description="Add Supabase logins, reset passwords, and toggle active or inactive status."><ManagerUserPanel accounts={accounts} /></SectionCard>
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <SectionCard eyebrow="Pricing summary" title="Baseline service fees" description="Edit these from Inventory; they prefill new technician estimates."><div className="space-y-3">{feeSettings.map((fee) => <div key={fee.id} className="flex items-center justify-between rounded-2xl border border-[#2d7dff]/20 bg-black/40 px-4 py-3"><p className="text-white">{fee.label}</p><p className="text-xl font-semibold text-[#bafcfc]">${fee.amount}</p></div>)}</div></SectionCard>
          <SectionCard eyebrow="Approvals & collections" title="Active estimates / invoices" description="Share by text or email from your phone, record manual payment, or revoke the customer link without deleting history.">
            <div className="space-y-3">{invoices.length === 0 ? <p className="text-sm text-zinc-400">No active estimates yet.</p> : invoices.map((invoice) => <div key={invoice.id} className="rounded-2xl border border-[#2d7dff]/10 bg-zinc-950/80 p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium text-white">{invoice.customerName} • {invoice.invoiceNumber}</p><StatusPill tone={invoice.status === "approved" ? "emerald" : "amber"}>{invoice.status === "approved" ? "Approved" : "Awaiting"}</StatusPill></div><p className="mt-2 text-sm text-zinc-400">Payment: {invoice.paymentMethod ? PAYMENT_METHOD_LABELS[invoice.paymentMethod] : "Not selected"} · {invoice.paymentStatus.replace(/_/g, " ")}</p><ManagerEstimateActions invoiceId={invoice.id} portalToken={invoice.portalToken} invoiceNumber={invoice.invoiceNumber} customerEmail={invoice.customerEmail} customerPhone={invoice.customerPhone} status={invoice.status} paymentStatus={invoice.paymentStatus} /></div>)}</div>
          </SectionCard>
        </div>
        <SectionCard eyebrow="Communication history" title="Recent workflow events" description="Approval/payment communication records retained in the CRM log."><div className="grid gap-3 md:grid-cols-2">{emailLog.length === 0 ? <p className="text-sm text-zinc-400">No events yet.</p> : emailLog.map((entry) => <div key={entry.id} className="rounded-2xl border border-[#2d7dff]/10 bg-zinc-950/80 p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium text-white">{entry.subject}</p><StatusPill>{entry.status}</StatusPill></div><p className="mt-2 text-sm text-zinc-400">{entry.recipients}</p></div>)}</div></SectionCard>
      </div>
    </AppShell>
  );
}
