export type StaffRole = "manager" | "technician" | "office";
export type StaffStatus = "active" | "inactive";

export type StaffAccount = { id: string; fullName: string; email: string; role: StaffRole; status: StaffStatus; phone: string | null; lastClockEvent: string | null; assignedJobs: number };
export type Customer = { id: string; name: string; address: string | null; phone: string | null; email: string | null; history: string[] };
export type PartsCatalogItem = { id: string; name: string; partNumber: string; defaultCost: number; retailPrice: number; stock: number };
export type PriceBookValueKind = "money" | "multiplier" | "formula" | "policy";
export type PriceBookEntry = { code: string; category: string; categoryKey: string; title: string; marketPrice: string; currentValue: number; description: string; kind: PriceBookValueKind };
export type FeeSetting = { id: string; label: string; amount: number };
export type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type Job = { id: string; customerId: string; customerName: string; assignedTechId: string | null; assignedTechName: string | null; status: JobStatus; location: string | null; scope: string | null; workPerformed: string | null; laborHours: number; driveHours: number; scheduledWindow: string | null; parts: { id: string; name: string; partNumber: string; retailPrice: number; quantity: number }[]; beforePhotos: { id: string; storagePath: string; caption: string | null; url: string | null }[]; afterPhotos: { id: string; storagePath: string; caption: string | null; url: string | null }[] };

export type InvoiceStatus = "draft" | "awaiting_approval" | "approved" | "void";
export type PaymentStatus = "unpaid" | "pending_manual_review" | "paid";
export type PaymentMethod = "cash" | "check" | "ach" | "cash_app" | "venmo" | "zelle" | "apple_pay" | "card";
export type AdjustmentType = "percent" | "dollar";
export type PaymentTerms = "due_on_receipt" | "net_7" | "net_15" | "net_30" | "custom";
export type InvoiceAdjustmentType = "credit" | "refund";

export type InvoiceLineItem = { id: string; label: string; amount: number };
export type DetailedInvoiceLineItem = InvoiceLineItem & { description: string | null; quantity: number; unitPrice: number; taxable: boolean };

export type Invoice = {
  id: string;
  invoiceNumber: string;
  portalToken: string;
  status: InvoiceStatus;
  customerId: string;
  customerName: string;
  jobId: string | null;
  signatureName: string | null;
  signedAt: string | null;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  notes: string | null;
  taxRate?: number;
  taxableSubtotal?: number;
  taxAmount?: number;
  issuedAt?: string | null;
  paymentTerms?: PaymentTerms;
  dueAt?: string | null;
  lastReminderAt?: string | null;
  reminderCount?: number;
  creditAmount?: number;
  refundAmount?: number;
  lineItems: InvoiceLineItem[];
};

export type DetailedInvoice = Omit<Invoice, "lineItems" | "taxRate" | "taxableSubtotal" | "taxAmount" | "issuedAt" | "paymentTerms" | "dueAt" | "lastReminderAt" | "reminderCount" | "creditAmount" | "refundAmount"> & {
  taxRate: number;
  taxableSubtotal: number;
  taxAmount: number;
  issuedAt: string | null;
  paymentTerms: PaymentTerms;
  dueAt: string | null;
  lastReminderAt: string | null;
  reminderCount: number;
  creditAmount: number;
  refundAmount: number;
  discountType: AdjustmentType | null;
  discountValue: number;
  discountAmount: number;
  downPaymentType: AdjustmentType | null;
  downPaymentValue: number;
  downPaymentAmount: number;
  lineItems: DetailedInvoiceLineItem[];
};

export type InvoiceAdjustment = { id: string; invoiceId: string; adjustmentType: InvoiceAdjustmentType; amount: number; reason: string; createdBy: string | null; createdAt: string };
export type Receipt = { id: string; receiptNumber: string; portalToken: string; invoiceId: string; amount: number; paymentMethod: PaymentMethod | null; paidAt: string; createdAt: string };
export type WorkflowEvent = { id: string; jobId: string | null; invoiceId: string | null; stage: string; message: string; createdAt: string };
export type EmailLogEntry = { id: string; subject: string; recipients: string; status: "queued" | "sent" | "failed"; createdAt: string };

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { cash: "Cash", check: "Check", ach: "ACH / Bank Transfer", cash_app: "Cash App", venmo: "Venmo", zelle: "Zelle", apple_pay: "Apple Pay", card: "Credit / Debit Card" };
export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = { due_on_receipt: "Due on receipt", net_7: "Net 7", net_15: "Net 15", net_30: "Net 30", custom: "Custom due date" };
