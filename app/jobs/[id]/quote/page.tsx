import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { QuoteBuilder } from "@/components/quote-builder";
import { getJobLifecycle } from "@/lib/chillbros/job-lifecycle-queries";
import { invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { partsProHref } from "@/lib/chillbros/parts-pro";
import { getFeeSettings } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const STATUS_TEXT: Record<string, string> = {
  draft: "Draft",
  awaiting_approval: "Waiting on the customer",
  approved: "Approved",
};

export default async function JobQuotePage({ params }: Props) {
  const [{ id }, profile] = await Promise.all([params, getCurrentStaffProfile()]);
  if (!profile) redirect("/sign-in");
  const lifecycle = await getJobLifecycle(id);
  if (!lifecycle) notFound();
  const { job, invoice } = lifecycle;
  if (profile.role === "technician" && job.assignedTechId !== profile.id) redirect("/technician");

  const back = `/jobs/${job.id}`;
  const canQuote = profile.role === "manager" || profile.role === "technician";
  const backLink = (
    <Link href={back} className="cb-card inline-flex min-h-11 items-center gap-1 px-3.5 font-semibold text-[#1557B0]">
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      Back to the call
    </Link>
  );

  // A quote already exists for this call: show it and where it stands.
  if (invoice) {
    const totals = invoiceTotals(invoice);
    return (
      <AppShell title="Quote" description={`${job.customerName} · ${invoice.invoiceNumber}`}>
        <div className="cb-new space-y-3.5">
          {backLink}
          <section className="cb-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[#0A1A33]/10 px-3.5 py-3">
              <h2 className="text-[28px] leading-none">{invoice.issuedAt ? "Invoice" : "Quote"}</h2>
              <span className="rounded-full bg-[#1557B0] px-3 py-1 text-sm font-bold text-white">{invoice.issuedAt ? "Invoiced" : STATUS_TEXT[invoice.status] ?? invoice.status}</span>
            </div>
            <ul className="divide-y divide-[#0A1A33]/10">
              {invoice.lineItems.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 bg-[#F8FAFD] px-3.5 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-bold text-[#0A1A33]">{item.label}</span>
                    <span className="block text-[13px] font-medium text-[#2B3F5C]">
                      {item.description ? `${item.description} · ` : ""}
                      {item.quantity} × {money(item.unitPrice)}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold text-[#0A1A33]">{money(item.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t border-[#0A1A33]/10 px-3.5 py-3 text-lg font-bold text-[#0A1A33]">
              <span>Total</span>
              <span>{money(totals.total)}</span>
            </p>
          </section>
          {profile.role !== "technician" ? (
            <Link href={`/invoices?focus=${invoice.id}`} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1557B0] text-base font-semibold text-white">
              <FileText className="h-5 w-5" aria-hidden="true" />
              {invoice.status === "awaiting_approval" ? "Send, remind or approve in Billing" : "Open in Billing"}
            </Link>
          ) : null}
        </div>
      </AppShell>
    );
  }

  if (!canQuote) {
    return (
      <AppShell title="Quote" description={job.customerName}>
        <div className="cb-new space-y-3.5">
          {backLink}
          <p className="cb-card p-3.5 font-semibold text-[#0A1A33]">Quotes are priced by the owner or the assigned technician. This call doesn&apos;t have one yet.</p>
        </div>
      </AppShell>
    );
  }

  const fees = await getFeeSettings();
  const suggestions = [
    ...job.parts.map((part) => ({ label: part.name, description: part.partNumber ? `Part # ${part.partNumber}` : "", quantity: part.quantity, unitPrice: part.retailPrice })),
    ...fees.map((fee) => ({ label: fee.label, description: "Service fee", quantity: 1, unitPrice: fee.amount })),
  ].slice(0, 20);

  return (
    <AppShell title="Build quote" description={`${job.customerName}${job.scope ? ` · ${job.scope}` : ""}`}>
      <div className="cb-new mb-3.5">{backLink}</div>
      <QuoteBuilder jobId={job.id} suggestions={suggestions} canApproveVerbally={profile.role === "manager"} partsProHref={partsProHref({ details: job.scope, back: `/jobs/${job.id}/quote` })} />
    </AppShell>
  );
}
