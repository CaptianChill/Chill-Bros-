"use client";

import { useState, useTransition } from "react";
import { setCustomerPaymentMethodAction } from "@/lib/chillbros/customer-payment-actions";
import type { PaymentMethod } from "@/lib/chillbros/types";

export function CashCheckPayment({ token, initialMethod }: { token: string; initialMethod: PaymentMethod | null }) {
  const [selected, setSelected] = useState(initialMethod);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function choose(method: "cash" | "check") {
    setMessage(""); setError("");
    startTransition(async () => {
      try {
        const result = await setCustomerPaymentMethodAction(token, method);
        if (!result.ok) { setError(result.error); return; }
        setSelected(method);
        setMessage("Payment choice saved. Chill Pros will confirm when payment is received.");
      } catch { setError("Could not save your payment choice. Please try again."); }
    });
  }
  return <fieldset className="space-y-3 rounded-2xl border border-current/20 p-4" disabled={pending}>
    <legend className="px-2 font-semibold">Pay by cash or check</legend>
    <div className="flex flex-wrap gap-5">{(["cash", "check"] as const).map(method => <label key={method} className="inline-flex min-h-12 cursor-pointer items-center gap-2"><input type="radio" name="cash-check-payment" value={method} checked={selected === method} onChange={() => choose(method)} className="h-5 w-5" />{method === "cash" ? "Cash" : "Check"}</label>)}</div>
    <p className="text-sm">Arrange payment directly with Chill Pros. Selecting an option does not mark this invoice paid.</p>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    {error ? <p role="alert" className="text-sm">{error}</p> : null}
  </fieldset>;
}
