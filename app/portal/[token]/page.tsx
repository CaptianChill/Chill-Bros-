import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { DocumentPaymentMethods } from "@/components/document-payment-methods";
import { DocumentSignatureForm } from "@/components/document-signature-form";
import { PortalFrame } from "@/components/customer-portal/portal-frame";
import { PortalView, type PortalTab, type PortalViewData } from "@/components/customer-portal/portal-view";
import { getInvoiceV2ByToken, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { getPaymentSettings } from "@/lib/chillbros/payment-settings";
import { squareCheckoutConfigured } from "@/lib/chillbros/square-checkout";
import { getPortalEquipmentHistory } from "@/lib/chillbros/portal-queries";
import { getJob } from "@/lib/chillbros/queries";
import { PAYMENT_TERMS_LABELS } from "@/lib/chillbros/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Chill Pros · Your service document" };
type PortalPageProps = { params: Promise<{ token: string }>; searchParams: Promise<{ payment?: string; payment_error?: string; tab?: string }> };

const date = (value: string | null) => value ? new Date(value).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" }) : null;

export default async function PortalPage({ params, searchParams }: PortalPageProps) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const invoice = await getInvoiceV2ByToken(token);
  if (!invoice) notFound();
  const [job, paymentSettings, history] = await Promise.all([
    invoice.jobId ? getJob(invoice.jobId) : null,
    getPaymentSettings(),
    getPortalEquipmentHistory(invoice.jobId, invoice.customerId),
  ]);
  const totals = invoiceTotals(invoice);
  const issued = Boolean(invoice.issuedAt);
  const paid = invoice.paymentStatus === "paid";
  const approved = invoice.status === "approved";
  const downPaymentRequired = invoice.downPaymentAmount > 0;
  const downPaymentPaid = invoice.downPaymentStatus === "paid";
  const downPaymentDue = approved && !issued && downPaymentRequired && !downPaymentPaid;
  const tab: PortalTab = query.tab === "photos" || query.tab === "equipment" ? query.tab : "overview";
  const scheduled = job?.scheduledWindow && !/^(Approved|Standalone)/.test(job.scheduledWindow) ? job.scheduledWindow : null;

  let headline: string, subline: string, statusLabel: string, statusTone: PortalViewData["statusTone"];
  if (paid) {
    [statusLabel, statusTone, headline, subline] = ["Paid", "success", "Thank you — this invoice is paid.", "Your receipt is available below. Keep this link for your records."];
  } else if (issued) {
    [statusLabel, statusTone, headline, subline] = ["Payment due", "attention", "Your service is complete.", "Review the work and pricing below, then choose how you'd like to pay."];
  } else if (approved) {
    [statusLabel, statusTone, headline] = ["Approved", "success", "Thank you — your estimate is approved."];
    subline = downPaymentDue
      ? "A down payment is due before work begins. You can pay it below."
      : "We'll complete the approved work or schedule your visit. No payment is due until the work is finished.";
  } else {
    [statusLabel, statusTone, headline, subline] = ["Awaiting your approval", "neutral", "Please review your estimate.", "Check the work and pricing below. Sign to approve and we'll schedule the work."];
  }

  const totalRows: PortalViewData["totals"] = [{ label: "Subtotal", value: totals.subtotal }];
  if (invoice.discountAmount > 0) totalRows.push({ label: `Discount${invoice.discountType === "percent" ? ` (${invoice.discountValue}%)` : ""}`, value: -invoice.discountAmount, tone: "success" });
  if (invoice.taxAmount > 0) totalRows.push({ label: `Sales tax (${invoice.taxRate}%)`, value: invoice.taxAmount });
  if (invoice.creditAmount > 0) totalRows.push({ label: "Credit applied", value: -invoice.creditAmount, tone: "success" });
  if (downPaymentRequired) totalRows.push({ label: downPaymentPaid ? "Down payment received" : "Down payment due now", value: Math.min(invoice.downPaymentAmount, totals.total), tone: downPaymentPaid ? "success" : "attention" });
  totalRows.push({ label: issued ? "Amount due" : "Estimate total", value: issued ? totals.amountDueNow : totals.total });

  const data: PortalViewData = {
    token,
    documentLabel: issued || paid ? "Invoice" : "Estimate",
    documentNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    serviceAddress: job?.location ?? null,
    statusLabel,
    statusTone,
    headline,
    subline,
    amountLabel: paid ? "Paid in full" : issued ? "Amount due" : downPaymentDue ? "Down payment due" : "Estimate total",
    amount: paid ? totals.total : issued ? totals.amountDueNow : downPaymentDue ? Math.min(invoice.downPaymentAmount, totals.total) : totals.total,
    dueLabel: issued && !paid ? [PAYMENT_TERMS_LABELS[invoice.paymentTerms], date(invoice.dueAt) ? `due ${date(invoice.dueAt)}` : null].filter(Boolean).join(" · ") : null,
    scheduledLabel: scheduled,
    lines: invoice.lineItems.map((item) => ({ id: item.id, label: item.label, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, amount: item.amount })),
    totals: totalRows,
    notes: invoice.notes?.trim() || null,
    canOpenPdf: approved ? (paid ? "paid" : "approved") : null,
    hasReceipt: paid,
    beforePhotos: job?.beforePhotos ?? [],
    afterPhotos: job?.afterPhotos ?? [],
    history,
  };

  // Approve / pay reuse the same actions as the printable document page.
  const actions = paid ? (
    <div className="flex items-start gap-3 rounded-xl border border-[#B7E3C8] bg-[#E6F6EC] p-4 text-[#11663A]">
      <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
      <div>
        <h2 className="text-lg font-bold">Payment received — thank you!</h2>
        <p className="mt-0.5 text-sm">{invoice.invoiceNumber} is paid in full. Your receipt is below.</p>
      </div>
    </div>
  ) : !approved ? (
    <div className="space-y-2">
      <h2 className="text-lg font-bold">Approve this estimate</h2>
      <DocumentSignatureForm kind="estimate" token={token} initialSignature={invoice.signatureName} initialSignedAt={invoice.signedAt} alreadyApproved={false} />
    </div>
  ) : issued && !paid ? (
    <div className="space-y-2">
      <h2 className="text-lg font-bold">Pay your invoice</h2>
      <DocumentPaymentMethods token={token} initialMethod={invoice.paymentMethod} paymentStatus={invoice.paymentStatus} amountDue={totals.amountDueNow} invoiceNumber={invoice.invoiceNumber} settings={paymentSettings} squareCheckout={squareCheckoutConfigured()} />
    </div>
  ) : downPaymentDue ? (
    <div className="space-y-2">
      <h2 className="text-lg font-bold">Pay your down payment</h2>
      <DocumentPaymentMethods token={token} initialMethod={invoice.downPaymentMethod} paymentStatus={invoice.downPaymentStatus} amountDue={invoice.downPaymentAmount} invoiceNumber={invoice.invoiceNumber} settings={paymentSettings} kind="down_payment" squareCheckout={squareCheckoutConfigured()} />
    </div>
  ) : (
    <DocumentSignatureForm kind="estimate" token={token} initialSignature={invoice.signatureName} initialSignedAt={invoice.signedAt} alreadyApproved />
  );

  const banner = query.payment_error ? (
    <p role="alert" className="rounded-xl border border-[#F2B8B5] bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#8C1D18]">{query.payment_error}</p>
  ) : query.payment === "processing" && !paid ? (
    <p role="status" className="rounded-xl border border-[#F3D48B] bg-[#FFF4DC] px-4 py-3 text-sm font-semibold text-[#7A4A00]">Payment submitted. Some payments take a little time to confirm; this page updates once it clears.</p>
  ) : query.payment === "cancelled" ? (
    <p role="status" className="rounded-xl border border-[#C7D3E2] bg-white px-4 py-3 text-sm font-semibold text-[#3D5170]">Checkout was cancelled. No payment was taken.</p>
  ) : null;

  return (
    <PortalFrame>
      <PortalView data={data} tab={tab} actions={actions} banner={banner} />
    </PortalFrame>
  );
}
