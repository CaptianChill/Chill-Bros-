import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { EstimateAdjustmentsEditor } from "@/components/estimate-adjustments-editor";
import { LiveOfficeRefresh } from "@/components/live-office-refresh";
import { ManagerEstimateActions } from "@/components/manager-estimate-actions";
import { ManagerUserPanel } from "@/components/manager-user-panel";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getInvoiceV2ByToken, getWorkflowEvents, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { PAYMENT_METHOD_LABELS, type DetailedInvoice } from "@/lib/chillbros/types";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { getFeeSettings, getStaffAccounts } from "@/lib/chillbros/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
type ManagerInvoice = { invoice: DetailedInvoice; customerEmail: string | null; customerPhone: string | null };

async function getManagerInvoices(): Promise<ManagerInvoice[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_invoices").select("portal_token,customer:chillbros_customers(email,phone)").in("status",["awaiting_approval","approved"]).is("revoked_at",null).order("updated_at",{ ascending:false }).limit(20);
  const loaded = await Promise.all((data ?? []).map(async (row) => {
    const invoice = await getInvoiceV2ByToken(row.portal_token);
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    return invoice ? { invoice, customerEmail: customer?.email ?? null, customerPhone: customer?.phone ?? null } : null;
  }));
  return loaded.filter((item): item is ManagerInvoice => Boolean(item));
}

export default async function ManagerPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");
  const [accounts, feeSettings, invoices, workflow] = await Promise.all([getStaffAccounts(), getFeeSettings(), getManagerInvoices(), getWorkflowEvents(20)]);

  return <AppShell title="Manager controls for staff, pricing, approvals, customer sharing, and audited payments." description="Technician saves, customer approvals, payment status, discounts, and dispatch changes now flow into one synchronized office queue." highlight={<div className="space-y-4"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Manager highlights</p><div className="space-y-3"><StatusPill tone="emerald">15-sec live office sync</StatusPill><StatusPill>Estimate approval queue</StatusPill><StatusPill>Audited payment controls</StatusPill></div></div>}>
    <LiveOfficeRefresh />
    <div className="space-y-4">
      <SectionCard eyebrow="User control panel" title="Staff accounts" description="Add logins, reset passwords, and toggle active or inactive status."><ManagerUserPanel accounts={accounts} /></SectionCard>
      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <SectionCard eyebrow="Pricing summary" title="Baseline service fees" description="These prefill technician estimates."><details className="group"><summary className="cursor-pointer text-sm text-[#bafcfc]">Show {feeSettings.length} fee presets</summary><div className="mt-3 space-y-2">{feeSettings.map((fee) => <div key={fee.id} className="flex items-center justify-between rounded-xl border border-[#2d7dff]/15 bg-black/40 px-3 py-2"><p className="text-sm text-white">{fee.label}</p><p className="font-semibold text-[#bafcfc]">{money(fee.amount)}</p></div>)}</div></details></SectionCard>
        <SectionCard eyebrow="Approvals & collections" title="Active estimates / invoices" description="Edit pre-approval discounts/deposits, open the secure document, record payment, or revoke access.">
          <div className="space-y-3">{invoices.length === 0 ? <p className="text-sm text-zinc-400">No active estimates yet.</p> : invoices.map(({ invoice, customerEmail, customerPhone }) => { const totals = invoiceTotals(invoice); return <details key={invoice.id} className="group rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/80 p-3"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div><p className="font-medium text-white">{invoice.customerName} • {invoice.invoiceNumber}</p><p className="mt-1 text-xs text-zinc-400">{money(totals.total)} • {invoice.paymentMethod ? PAYMENT_METHOD_LABELS[invoice.paymentMethod] : "Payment not selected"}</p></div><StatusPill tone={invoice.paymentStatus === "paid" || invoice.status === "approved" ? "emerald" : "amber"}>{invoice.paymentStatus === "paid" ? "Paid" : invoice.status === "approved" ? "Approved" : "Awaiting"}</StatusPill></summary><div className="mt-3 space-y-3"><EstimateAdjustmentsEditor invoice={invoice} /><ManagerEstimateActions invoiceId={invoice.id} portalToken={invoice.portalToken} invoiceNumber={invoice.invoiceNumber} customerEmail={customerEmail} customerPhone={customerPhone} status={invoice.status} paymentStatus={invoice.paymentStatus} /></div></details>; })}</div>
        </SectionCard>
      </div>
      <SectionCard eyebrow="Live workflow" title="Technician → approval → invoicing status" description="Latest state changes from technicians, Dispatch, customer approval, pricing changes, and payment collection."><div className="space-y-2">{workflow.length === 0 ? <p className="text-sm text-zinc-400">No workflow events yet.</p> : workflow.map((entry) => <div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#2d7dff]/10 bg-zinc-950/80 p-3"><div><p className="text-sm text-white">{entry.message}</p><p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#bafcfc]">{entry.stage.replace(/_/g," ")}</p></div><p className="shrink-0 text-xs text-zinc-500">{new Date(entry.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}</p></div>)}</div></SectionCard>
    </div>
  </AppShell>;
}
