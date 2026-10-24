// Down payment rule shared by the customer portal and the office/tech job actions.
// When a quote carries a down payment, the customer pays it at approval, and the
// sold work (parts ordering, Work Now, scheduling the return visit) stays locked
// until that down payment is recorded — by card through Square or manually in Payments.

export type DownPaymentFields = {
  downPaymentAmount: number;
  downPaymentStatus: string | null;
  downPaymentType?: string | null;
  downPaymentValue?: number | null;
  convertedInvoiceId?: string | null;
};

const usd = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function downPaymentRequired(invoice: DownPaymentFields) {
  return !invoice.convertedInvoiceId && Number(invoice.downPaymentAmount) > 0;
}

/** True while a required down payment has not been paid: sold work must wait. */
export function downPaymentBlocksWork(invoice: DownPaymentFields) {
  return downPaymentRequired(invoice) && invoice.downPaymentStatus !== "paid";
}

/** "$627.50 (50%)" — the amount the customer owes up front, capped at the total. */
export function downPaymentLabel(invoice: DownPaymentFields, total?: number) {
  const amount = total === undefined ? Number(invoice.downPaymentAmount) : Math.min(Number(invoice.downPaymentAmount), total);
  const percent = invoice.downPaymentType === "percent" && invoice.downPaymentValue ? ` (${Number(invoice.downPaymentValue)}%)` : "";
  return `${usd(amount)}${percent}`;
}

/** Message shown to office/techs when they try to start or schedule work before the deposit is in. */
export function downPaymentBlockedMessage(invoice: DownPaymentFields) {
  return `Waiting on the ${downPaymentLabel(invoice)} down payment. Don't order parts or start the work until it's paid. If the customer paid by cash, check, Zelle, Venmo or Chime, record it in Payments → Down payments to unlock this job.`;
}
