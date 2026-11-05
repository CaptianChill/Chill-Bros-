export const MARKET_TERMS = "2026-11-v1";
export const emailAddress = (value: unknown) => {
  const email = String(value ?? "").trim().toLowerCase();
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};
export const cleanText = (value: unknown, max = 1000) => String(value ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
export const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
export function cents(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(text)) throw new Error("Enter a dollar amount with at most two decimal places.");
  return Math.round(Number(text) * 100);
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@\-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function leadCsv(lead: Record<string, unknown>) {
  const keys = ["business_name", "city", "business_address", "contact_name", "contact_role", "contact_email", "contact_phone", "service_line", "source_url", "signal_observed_at", "tier", "sale_type", "max_buyers"];
  return "\uFEFF" + keys.map(csvCell).join(",") + "\r\n" + keys.map((key) => csvCell(lead[key])).join(",") + "\r\n";
}

/** Reject local/reserved destinations before resolving a buyer's SMTP host. */
export function publicIp(value: string) {
  const v = value.toLowerCase();
  if (v.includes(":")) {
    if (v.startsWith("::ffff:")) return publicIp(v.slice(7));
    return /^[23][0-9a-f]{3}:/.test(v) && !v.startsWith("2001:db8:");
  }
  const parts = v.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b))
    || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
}
export function introductoryEmail(company: string, service: string, postal: string, unsubscribe: string) {
  const label = cleanText(company, 160).replace(/[\r\n]/g, " ");
  return {
    subject: `Equipment service introduction from ${label}`,
    text: `Hello,\n\nThis is a business service introduction from ${label}. We offer ${cleanText(service, 180)}.\n\nAre you the right person for equipment service or vendor requests? If there is a current need, please reply with the details. We have not confirmed a current equipment problem at your business.\n\n${label}\n${cleanText(postal, 500)}\n\nThis is a commercial introduction. To stop messages from this business, use this link: ${unsubscribe}\nYou can also reply asking us to stop.`,
  };
}
