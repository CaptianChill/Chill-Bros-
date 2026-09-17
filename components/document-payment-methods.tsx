import type { PaymentMethod } from "@/lib/chillbros/types";
import { CashCheckPayment } from "@/components/cash-check-payment";
import { SquarePayment } from "@/components/square-payment";

export function DocumentPaymentMethods({ paymentStatus, amountDue, invoiceNumber, token, initialMethod }: {
  token: string;
  initialMethod: PaymentMethod | null;
  paymentStatus: string;
  amountDue: number;
  invoiceNumber: string;
}) {
  if (paymentStatus === "paid") return <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Payment received. Thank you.</div>;
  return <div className="space-y-4"><SquarePayment document amountDue={amountDue} invoiceNumber={invoiceNumber} /><CashCheckPayment token={token} initialMethod={initialMethod} /></div>;
}
