// Shared by the server (spoken read-back) and the review screen so both show the same numbers.
type TotalsInput = { lines: { quantity: number; unitPrice: number; taxable: boolean }[]; discount: number; taxRate: number; downPaymentType: "" | "percent" | "dollar"; downPaymentValue: number };

export function voiceDraftTotals(d: TotalsInput) {
  const subtotal = d.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const taxable = d.lines.filter((l) => l.taxable).reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const discount = Math.max(0, Math.min(d.discount, subtotal));
  const taxableAfter = subtotal > 0 ? Math.max(0, taxable - discount * (taxable / subtotal)) : 0;
  const tax = Math.round(taxableAfter * d.taxRate) / 100;
  const total = Math.round((subtotal - discount + tax) * 100) / 100;
  const down = d.downPaymentType === "percent" ? Math.round(total * d.downPaymentValue) / 100 : d.downPaymentType === "dollar" ? Math.min(d.downPaymentValue, total) : 0;
  return { subtotal, discount, tax, total, down };
}

export const spokenMoney = (n: number) => {
  const dollars = Math.floor(n), cents = Math.round((n - dollars) * 100);
  return cents ? `${dollars.toLocaleString("en-US")} dollars and ${cents} cents` : `${dollars.toLocaleString("en-US")} dollars`;
};
