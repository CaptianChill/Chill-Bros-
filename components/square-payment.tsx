import { SQUARE_PAYMENT_URL, squarePaymentAvailable } from "@/lib/chillbros/square-payment";

export function SquarePayment({ amountDue, invoiceNumber, document = false }: {
  amountDue: number;
  invoiceNumber: string;
  document?: boolean;
}) {
  const money = amountDue.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return <section className={document ? "space-y-3 rounded-2xl border-2 border-zinc-900 bg-white p-4 text-zinc-900" : "space-y-3 rounded-3xl border border-[#8ffafa]/30 bg-[#06111b]/70 p-5 text-white"}>
    <h3 className="font-bold">Pay with Square</h3>
    <p className="text-sm">Invoice {invoiceNumber} · Amount due: <strong>{money}</strong></p>
    {squarePaymentAvailable(amountDue) ? <>
      <p className="text-sm leading-6">Enter {money} in Square and use the name and email from your invoice so we can match your payment.</p>
      <a href={SQUARE_PAYMENT_URL} target="_blank" rel="noopener noreferrer" className="print:hidden inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#2d7dff] px-4 py-3 font-bold text-white">Pay with Square<span className="sr-only"> (opens in a new tab)</span></a>
      <p className="hidden break-all text-sm print:block">Pay online: {SQUARE_PAYMENT_URL}</p>
      <p className="text-xs leading-5">Your invoice stays unpaid here until Chill Pros confirms your Square payment. If you have already paid, keep your Square receipt and contact us before paying again.</p>
    </> : <p className="text-sm">Contact Chill Pros to settle this invoice. This amount cannot be paid through the shared Square link.</p>}
  </section>;
}
