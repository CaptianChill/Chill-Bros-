import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { LiveOfficeRefresh } from "@/components/live-office-refresh";
import { ManagerEstimateActions } from "@/components/manager-estimate-actions";
import { OfficeDocumentActions } from "@/components/office-document-actions";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import type { InvoiceStatus, PaymentStatus } from "@/lib/chillbros/types";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const centralDateTime = (value: string) => new Date(value).toLocaleString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Chicago",
});

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  portalToken: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  updatedAt: string;
  total: number;
};

async function getInvoices(): Promise<InvoiceRow[]> {
  const supabase = createServiceRoleClient();
  const { data: invoices, error } = await supabase
    .from("chillbros_invoices")
    .select("id,invoice_number,portal_token,status,payment_status,updated_at,customer:chillbros_customers(name,email,phone)")
    .is("revoked_at", null)
    .neq("status", "void")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error || !invoices) return [];

  const ids = invoices.map((invoice) => invoice.id);
  const { data: lines } = ids.length
    ? await supabase.from("chillbros_invoice_line_items").select("invoice_id,amount").in("invoice_id", ids)
    : { data: [] as { invoice_id: string; amount: number | string | null }[] };

  const totals = new Map<string, number>();
  for (const line of lines ?? []) {
    totals.set(line.invoice_id, (totals.get(line.invoice_id) ?? 0) + Number(line.amount ?? 0));
  }

  return invoices.map((invoice) => {
    const customer = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      portalToken: invoice.portal_token,
      status: invoice.status as InvoiceStatus,
      paymentStatus: invoice.payment_status as PaymentStatus,
      customerName: customer?.name ?? "Unknown customer",
      customerEmail: customer?.email ?? null,
      customerPhone: customer?.phone ?? null,
      updatedAt: invoice.updated_at,
      total: totals.get(invoice.id) ?? 0,
    };
  });
}

export default async function InvoicesPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");

  const invoices = await getInvoices();
  const awaiting = invoices.filter((invoice) => invoice.status === "awaiting_approval").length;
  const approved = invoices.filter((invoice) => invoice.status === "approved").length;
  const paid = invoices.filter((invoice) => invoice.paymentStatus === "paid").length;
  const openBalance = invoices.filter((invoice) => invoice.paymentStatus !== "paid").reduce((sum, invoice) => sum + invoice.total, 0);

  return <AppShell
    title="Invoices"
    description="Review every active Chill Bros estimate and invoice, open customer documents, send secure links, and manage collection status from one page."
    highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Invoice center</p><StatusPill tone="emerald">{invoices.length} active</StatusPill><StatusPill>{paid} paid</StatusPill></div>}
  >
    <LiveOfficeRefresh />
    <div className="space-y-4 sm:space-y-6">
      <SectionCard eyebrow="Live totals" title="Invoice operating pulse" description="Current active document and collection status.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Awaiting approval", awaiting],
            ["Approved", approved],
            ["Paid", paid],
            ["Open invoice value", money(openBalance)],
          ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3 text-center"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-xl font-semibold text-white">{value}</p></div>)}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Documents" title="All active invoices" description="Newest activity first. Open the customer view or full document directly from each invoice.">
        <div className="space-y-3">
          {invoices.length === 0 ? <p className="text-sm text-zinc-400">No active invoices found.</p> : invoices.map((invoice) => (
            <details key={invoice.id} className="group rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/80 p-3">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{invoice.customerName}</p>
                  <p className="mt-1 text-xs text-zinc-400">{invoice.invoiceNumber} • {centralDateTime(invoice.updatedAt)}</p>
                  <p className="mt-2 text-lg font-semibold text-[#bafcfc]">{money(invoice.total)}</p>
                </div>
                <StatusPill tone={invoice.paymentStatus === "paid" || invoice.status === "approved" ? "emerald" : "amber"}>{invoice.paymentStatus === "paid" ? "Paid" : invoice.status === "approved" ? "Approved" : "Awaiting approval"}</StatusPill>
              </summary>
              <div className="mt-4 border-t border-[#2d7dff]/10 pt-3">
                {profile.role === "manager" ? (
                  <ManagerEstimateActions invoiceId={invoice.id} portalToken={invoice.portalToken} invoiceNumber={invoice.invoiceNumber} customerEmail={invoice.customerEmail} customerPhone={invoice.customerPhone} status={invoice.status} paymentStatus={invoice.paymentStatus} />
                ) : (
                  <OfficeDocumentActions portalToken={invoice.portalToken} invoiceNumber={invoice.invoiceNumber} customerEmail={invoice.customerEmail} customerPhone={invoice.customerPhone} />
                )}
              </div>
            </details>
          ))}
        </div>
      </SectionCard>
    </div>
  </AppShell>;
}
