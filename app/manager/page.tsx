import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
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
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  customerName: string;
};

async function getAwaitingApprovalInvoices(): Promise<AwaitingApprovalInvoice[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("chillbros_invoices")
    .select("id, invoice_number, status, payment_status, payment_method, customer:chillbros_customers(name)")
    .in("status", ["awaiting_approval", "approved"])
    .order("updated_at", { ascending: false })
    .limit(8);
  return (data ?? []).map((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      status: row.status,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      customerName: customer?.name ?? "Unknown customer",
    };
  });
}

export default async function ManagerPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");

  const [accounts, feeSettings, emailLog, invoices] = await Promise.all([
    getStaffAccounts(),
    getFeeSettings(),
    getEmailLog(6),
    getAwaitingApprovalInvoices(),
  ]);

  return (
    <AppShell
      title="Manager and owner controls for credentials, pricing, dispatch approvals, and communication review."
      description="This hub centralizes the internal-only workflows: technician account management, automated fee controls, customer approval triage, and a communication center that keeps the office informed."
      highlight={
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Manager highlights</p>
          <div className="space-y-3">
            <StatusPill tone="emerald">Technician credential control</StatusPill>
            <StatusPill>Approval queue ready</StatusPill>
            <StatusPill>Inventory fee presets</StatusPill>
          </div>
          <p className="text-sm leading-7 text-zinc-300">Add or edit technicians, reset passwords, and review the approval chain that feeds parts ordering and invoicing.</p>
        </div>
      }
    >
      <div className="space-y-6">
        <SectionCard eyebrow="User control panel" title="Staff accounts" description="Add real Supabase logins, reset passwords, and toggle active or inactive status directly from the manager dashboard.">
          <ManagerUserPanel accounts={accounts} />
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <SectionCard eyebrow="Pricing admin" title="Automatic fee controls" description="Baseline fees that auto-populate on new service quotes and invoices.">
            <div className="space-y-3">
              {feeSettings.map((fee) => (
                <div key={fee.id} className="flex items-center justify-between rounded-2xl border border-[#2d7dff]/20 bg-black/40 px-4 py-3">
                  <div>
                    <p className="text-white">{fee.label}</p>
                    <p className="text-sm text-zinc-400">Applies automatically on new customer quotes</p>
                  </div>
                  <p className="text-xl font-semibold text-[#bafcfc]">${fee.amount}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard eyebrow="Dispatch and communication" title="Order review + email center" description="Customer approvals surface here immediately so parts ordering and office follow-up can happen without delay.">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
                <h3 className="font-medium text-white">Invoice approvals</h3>
                {invoices.length === 0 ? (
                  <p className="text-sm text-zinc-400">Nothing awaiting approval yet.</p>
                ) : (
                  invoices.map((invoice) => (
                    <div key={invoice.id} className="rounded-2xl border border-[#2d7dff]/10 bg-zinc-950/80 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{invoice.customerName} • {invoice.invoiceNumber}</p>
                        <StatusPill tone={invoice.status === "approved" ? "emerald" : "amber"}>{invoice.status === "approved" ? "Approved" : "Awaiting"}</StatusPill>
                      </div>
                      <p className="mt-2 text-sm text-zinc-400">
                        Payment: {invoice.paymentMethod ? PAYMENT_METHOD_LABELS[invoice.paymentMethod] : "Not selected"} · {invoice.paymentStatus.replace(/_/g, " ")}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
                <h3 className="font-medium text-white">Email logs</h3>
                {emailLog.length === 0 ? (
                  <p className="text-sm text-zinc-400">No outbound email events logged yet.</p>
                ) : (
                  emailLog.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-[#2d7dff]/10 bg-zinc-950/80 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{entry.subject}</p>
                        <StatusPill>{entry.status}</StatusPill>
                      </div>
                      <p className="mt-2 text-sm text-zinc-400">{entry.recipients}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
