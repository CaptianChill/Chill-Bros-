// Track Record: turns real job and invoice history into the proof numbers a
// buyer, lender or investor asks for (collected revenue by month, trailing
// 12 months, average ticket, repeat customers, completed work).
// Pure functions only, so the same math is used by the page, the CSV export
// and the tests. Nothing here writes to the database.

export type TrackJob = { id: string; customerId: string | null; status: string; createdAt: string | null; archivedAt?: string | null };
export type TrackInvoice = {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string | null;
  convertedInvoiceId: string | null;
  revokedAt: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  credits: number;
  refunds: number;
};

export type LedgerRow = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issuedAt: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  state: "paid" | "outstanding";
  total: number;
  collected: number;
};

export type MonthRow = { month: string; collected: number; invoicesPaid: number; callsBooked: number; callsCompleted: number };

export type TrackRecord = {
  asOf: string;
  firstActivity: string | null;
  lifetimeCollected: number;
  trailing12Collected: number;
  previous12Collected: number;
  invoicesPaid: number;
  averageTicket: number;
  outstandingValue: number;
  outstandingCount: number;
  customersPaying: number;
  repeatCustomers: number;
  repeatRate: number;
  callsBooked: number;
  callsCompleted: number;
  months: MonthRow[];
  ledger: LedgerRow[];
};

// Every status that means the field work is done, not just the literal "completed".
export const DONE_JOB_STATUSES = new Set(["work_complete", "ready_to_invoice", "invoice_sent", "paid", "completed"]);

const cents = (value: number) => Math.round(value * 100) / 100;

export function isRealInvoice(invoice: Pick<TrackInvoice, "invoiceNumber" | "status" | "convertedInvoiceId" | "revokedAt" | "issuedAt" | "paymentStatus">) {
  if (invoice.revokedAt || invoice.convertedInvoiceId) return false; // converted quotes live on as their invoice
  if (invoice.status === "void" || invoice.status === "draft") return false;
  if (invoice.invoiceNumber.toUpperCase().startsWith("Q-")) return false; // quotes are not income
  return Boolean(invoice.issuedAt) || invoice.paymentStatus === "paid";
}

export function invoiceTotal(invoice: Pick<TrackInvoice, "subtotal" | "discount" | "tax" | "credits">) {
  return cents(Math.max(0, invoice.subtotal - invoice.discount + invoice.tax - invoice.credits));
}

export function monthKey(iso: string) {
  // Month in Chill Pros' local time (San Antonio) so a 9pm payment on the 31st stays in that month.
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

function lastMonths(asOf: Date, count: number) {
  const [year, month] = monthKey(asOf.toISOString()).split("-").map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export function buildTrackRecord(jobs: TrackJob[], invoices: TrackInvoice[], asOf = new Date()): TrackRecord {
  const ledger: LedgerRow[] = [];
  for (const invoice of invoices) {
    if (!isRealInvoice(invoice)) continue;
    const total = invoiceTotal(invoice);
    const paid = invoice.paymentStatus === "paid";
    if (!paid && invoice.status !== "approved") continue;
    ledger.push({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      issuedAt: invoice.issuedAt,
      paidAt: paid ? invoice.paidAt ?? invoice.issuedAt ?? invoice.createdAt : null,
      paymentMethod: invoice.paymentMethod,
      state: paid ? "paid" : "outstanding",
      total,
      collected: paid ? cents(Math.max(0, total - invoice.refunds)) : 0,
    });
  }
  ledger.sort((a, b) => String(b.paidAt ?? b.issuedAt ?? "").localeCompare(String(a.paidAt ?? a.issuedAt ?? "")));

  const months = lastMonths(asOf, 24);
  const byMonth = new Map<string, MonthRow>(months.map((m) => [m, { month: m, collected: 0, invoicesPaid: 0, callsBooked: 0, callsCompleted: 0 }]));
  const paidRows = ledger.filter((row) => row.state === "paid");
  for (const row of paidRows) {
    if (!row.paidAt) continue;
    const bucket = byMonth.get(monthKey(row.paidAt));
    if (bucket) { bucket.collected = cents(bucket.collected + row.collected); bucket.invoicesPaid += 1; }
  }
  const liveJobs = jobs.filter((job) => job.status !== "cancelled");
  for (const job of liveJobs) {
    if (!job.createdAt) continue;
    const bucket = byMonth.get(monthKey(job.createdAt));
    if (!bucket) continue;
    bucket.callsBooked += 1;
    if (DONE_JOB_STATUSES.has(job.status)) bucket.callsCompleted += 1;
  }

  const monthRows = months.map((m) => byMonth.get(m)!);
  const sum = (rows: MonthRow[]) => cents(rows.reduce((total, row) => total + row.collected, 0));
  const lifetimeCollected = cents(paidRows.reduce((total, row) => total + row.collected, 0));

  const paidByCustomer = new Map<string, number>();
  for (const invoice of invoices) {
    if (!isRealInvoice(invoice) || invoice.paymentStatus !== "paid") continue;
    const key = invoice.customerId ?? invoice.customerName;
    paidByCustomer.set(key, (paidByCustomer.get(key) ?? 0) + 1);
  }
  const repeatCustomers = [...paidByCustomer.values()].filter((count) => count > 1).length;
  const outstanding = ledger.filter((row) => row.state === "outstanding");

  const dates = [...jobs.map((j) => j.createdAt), ...invoices.map((i) => i.issuedAt ?? i.createdAt)].filter((d): d is string => Boolean(d)).sort();

  return {
    asOf: asOf.toISOString(),
    firstActivity: dates[0] ?? null,
    lifetimeCollected,
    trailing12Collected: sum(monthRows.slice(12)),
    previous12Collected: sum(monthRows.slice(0, 12)),
    invoicesPaid: paidRows.length,
    averageTicket: paidRows.length ? cents(lifetimeCollected / paidRows.length) : 0,
    outstandingValue: cents(outstanding.reduce((total, row) => total + row.total, 0)),
    outstandingCount: outstanding.length,
    customersPaying: paidByCustomer.size,
    repeatCustomers,
    repeatRate: paidByCustomer.size ? repeatCustomers / paidByCustomer.size : 0,
    callsBooked: liveJobs.length,
    callsCompleted: liveJobs.filter((job) => DONE_JOB_STATUSES.has(job.status)).length,
    months: monthRows.slice(12).reverse(),
    ledger,
  };
}

const csvCell = (value: string | number | null) => {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) || /^[=+\-@]/.test(text) ? `"${text.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : text;
};

export function trackRecordCsv(record: TrackRecord) {
  const header = ["Invoice", "Customer", "Issued", "Paid", "Status", "Payment method", "Invoice total", "Collected"];
  const rows = record.ledger.map((row) => [row.invoiceNumber, row.customerName, row.issuedAt?.slice(0, 10) ?? "", row.paidAt?.slice(0, 10) ?? "", row.state, row.paymentMethod ?? "", row.total.toFixed(2), row.collected.toFixed(2)]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}
