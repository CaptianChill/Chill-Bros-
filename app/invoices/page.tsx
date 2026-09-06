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
  balance: number;
};

async function getInvoices(): Promise<InvoiceRow[]> {
  const supabase = createServiceRoleClient();
  const { data: invoices, error } = await supabase
    .from("chillbros_invoices")
    .select("id,invoice_number,portal_token,status,payment_status,updated_at,discount_amount,down_payment_amount,customer:chillbros_customers(name,email,phone)")
    .is("revoked_at", null)
    .neq("status", "void")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error || !invoices) return [];

  const ids = invoices.map((invoice) => invoice.id);
  const { data: lines } = ids.length
    ? await supabase.from("chillbros_invoice_line_items").select("invoice_id,amount").in("invoice_id", ids)
    : { data: [] as { invoice_id: string; amount: number | string | null }[] };

  const subtotals = new Map<string, number>();
  for (const line of lines ?? []) {
    subtotals.set(line.invoice_id, (subtotals.get(line.invoice_id) ?? 0) + Number(line.amount ?? 0));
  }

  return invoices.map((invoice) => {
    const customer = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
    const subtotal = subtotals.get(invoice.id) ?? 0;
    const total = Math.max(0, subtotal - Number(invoice.discount_amount ?? 0));
    const balance = invoice.payment_status === "paid" ? 0 : Math.max(0, total - Number(invoice.down_payment_amount ?? 0));
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
      total,
      balance,
    };
  });
}

export default async function InvoicesPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");

  const invoices = await getInvoices();
  const awaiting = invoices.filter((invoice) => invoice.status === "awaiting_approval").length;
  const approvedUnpaid = invoices.filter((invoice) => invoice.status === "approved" && invoice.paymentStatus !== "paid").length;
  const paid = invoices.filter((invoice) => invoice.paymentStatus === "paid").length;
  const receivables = invoices.reduce((sum, invoice) => sum + invoice.balance, 0);

  return <AppShell title="Invoices">
    <LiveOfficeRefresh />
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          ["Awaiting approval", awaiting],
          ["Approved / unpaid", approvedUnpaid],
          ["Paid", paid],
          ["Receivables", money(receivables)],
        ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-[#2d7dff]/18 bg-black/35 px-3 py-3 text-center"><p className="text-[11px] text-zinc-500">{label}</p><p className="mt-1.5 text-xl font-semibold text-white">{value}</p></div>)}
      </div>

      <SectionCard title="Invoice center">
        <div className="space-y-2.5">
          {invoices.length === 0 ? <p className="py-4 text-center text-sm text-zinc-400">No active invoices found.</p> : invoices.map((invoice) => (
            <details key={invoice.id} className="group rounded-xl border border-[#2d7dff]/15 bg-zinc-950/75 p-3">
              <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="truncate font-medium text-white">{invoice.customerName}</p>
                    <p className="text-xs text-zinc-500">{invoice.invoiceNumber}</p>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Updated {centralDateTime(invoice.updatedAt)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <p className="text-base font-semibold text-[#bafcfc]">{money(invoice.total)}</p>
                    {invoice.balance > 0 ? <p className="text-xs text-zinc-400">Balance {money(invoice.balance)}</p> : null}
                  </div>
                </div>
                <StatusPill tone={invoice.paymentStatus === "paid" || invoice.status === "approved" ? "emerald" : "amber"}>{invoice.paymentStatus === "paid" ? "Paid" : invoice.status === "approved" ? "Approved" : "Awaiting"}</StatusPill>
              </summary>

              <div className="mt-3 border-t border-[#2d7dff]/10 pt-3">
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
