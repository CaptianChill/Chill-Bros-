export type StaffRole = "manager" | "technician" | "office";
export type StaffStatus = "active" | "inactive";

export type StaffAccount = { id: string; fullName: string; email: string; role: StaffRole; status: StaffStatus; phone: string | null; lastClockEvent: string | null; assignedJobs: number };
export type Customer = { id: string; name: string; address: string | null; phone: string | null; email: string | null; history: string[] };
export type PartsCatalogItem = { id: string; name: string; partNumber: string; defaultCost: number; retailPrice: number; stock: number };
export type FeeSetting = { id: string; label: string; amount: number };
export type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type Job = { id: string; customerId: string; customerName: string; assignedTechId: string | null; assignedTechName: string | null; status: JobStatus; location: string | null; scope: string | null; workPerformed: string | null; laborHours: number; driveHours: number; scheduledWindow: string | null; parts: { id: string; name: string; partNumber: string; retailPrice: number; quantity: number }[]; beforePhotos: { id: string; storagePath: string; caption: string | null; url: string | null }[]; afterPhotos: { id: string; storagePath: string; caption: string | null; url: string | null }[] };

export type InvoiceStatus = "draft" | "awaiting_approval" | "approved" | "void";
export type PaymentStatus = "unpaid" | "pending_manual_review" | "paid";
export type PaymentMethod = "cash_app" | "venmo" | "zelle" | "apple_pay" | "card";
export type AdjustmentType = "percent" | "dollar";

export type InvoiceLineItem = { id: string; label: string; amount: number };
export type DetailedInvoiceLineItem = InvoiceLineItem & { description: string | null; quantity: number; unitPrice: number };

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
  lineItems: InvoiceLineItem[];
};

export type DetailedInvoice = Omit<Invoice, "lineItems"> & {
  discountType: AdjustmentType | null;
  discountValue: number;
  discountAmount: number;
  downPaymentType: AdjustmentType | null;
  downPaymentValue: number;
  downPaymentAmount: number;
  lineItems: DetailedInvoiceLineItem[];
};

export type WorkflowEvent = { id: string; jobId: string | null; invoiceId: string | null; stage: string; message: string; createdAt: string };
export type EmailLogEntry = { id: string; subject: string; recipients: string; status: "queued" | "sent" | "failed"; createdAt: string };

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { cash_app: "Cash App", venmo: "Venmo", zelle: "Zelle", apple_pay: "Apple Pay", card: "Credit / Debit Card" };
