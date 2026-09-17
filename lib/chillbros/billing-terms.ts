import type { PaymentTerms } from "./types";

export function approvalDueAt(terms: PaymentTerms, currentDueAt: string | null, now: Date) {
  if (terms === "custom" && currentDueAt) return currentDueAt;
  const days = terms === "net_7" ? 7 : terms === "net_15" ? 15 : terms === "net_30" ? 30 : 0;
  const due = new Date(now);
  due.setUTCDate(due.getUTCDate() + days);
  return due.toISOString();
}
