import type { PaymentMethod } from "@/lib/chillbros/types";
import { PaymentMethodTabs, type ManualPaymentSettings } from "@/components/payment-method-tabs";

export function DocumentPaymentMethods({ paymentStatus, amountDue, invoiceNumber, token, initialMethod, settings, kind = "invoice" }: {
  token: string;
  initialMethod: PaymentMethod | null;
  paymentStatus: string;
  amountDue: number;
  invoiceNumber: string;
  settings: ManualPaymentSettings;
  kind?: "invoice" | "down_payment";
}) {
  return <PaymentMethodTabs document token={token} amountDue={amountDue} invoiceNumber={invoiceNumber} paymentStatus={paymentStatus} initialMethod={initialMethod} settings={settings} kind={kind} />;
}
