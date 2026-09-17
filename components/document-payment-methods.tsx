import { SquarePayment } from "@/components/square-payment";

export function DocumentPaymentMethods({ paymentStatus, amountDue, invoiceNumber }: {
  paymentStatus: string;
  amountDue: number;
  invoiceNumber: string;
}) {
  if (paymentStatus === "paid") return <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Payment received. Thank you.</div>;
  return <SquarePayment document amountDue={amountDue} invoiceNumber={invoiceNumber} />;
}
