// Who must never get marketing email. Pure (no imports) so it is unit-tested.

const INTERNAL_EMAILS = new Set(["chillprostx@gmail.com", "chillbrostx@gmail.com", "brae.morrison93@gmail.com"]);

/** Company, owner and test records never get marketing email. */
export function isInternalOrTestCustomer(name: string | null | undefined, email: string, companyEmail = typeof process !== "undefined" ? String(process.env.COMPANY_MAIN_EMAIL || "") : "") {
  if (INTERNAL_EMAILS.has(email) || email.endsWith("@removed.invalid")) return true;
  if (companyEmail && email === companyEmail.trim().toLowerCase()) return true;
  return /\b(test|demo|sample|blah|fake|dummy)\b/i.test(String(name ?? "")) || /^chill pros customer$/i.test(String(name ?? "").trim());
}
