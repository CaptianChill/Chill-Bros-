/**
 * Customer email lists.
 *
 * A customer has one main email (`email`, also pre-filled as the buyer email
 * in Square checkout, so it must stay a single address) plus optional
 * `cc_emails`: extra people copied on invoices, estimates, reminders,
 * receipts and job notices, e.g. "julia@rosellacoffee.com, gm@rosellacoffee.com".
 * Everyone on either field can sign in to the customer homepage (/my).
 * The office "send to a different email" box also takes a list: first = To, rest = CC.
 *
 * Pure helpers: safe to import from server and client code.
 */

const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
export const MAX_CUSTOMER_EMAILS = 10;
/** Stored column limit for the whole list. */
export const MAX_EMAIL_LIST_LENGTH = 1000;

export function isValidEmail(value: string) {
  return value.length <= 320 && EMAIL_PATTERN.test(value);
}

/** Splits a raw email field into lowercased, trimmed, de-duplicated parts (valid or not). */
export function splitEmailList(value: string | null | undefined): string[] {
  const parts = String(value ?? "")
    .split(/[\s,;]+/)
    .map((part) => part.trim().replace(/^<|>$/g, "").toLowerCase())
    .filter(Boolean);
  return [...new Set(parts)];
}

/** Only the valid addresses, in order. The first one is the main ("To") contact. */
export function parseEmailList(value: string | null | undefined): string[] {
  return splitEmailList(value).filter(isValidEmail);
}

/**
 * Validates and normalizes user input for a customer email field.
 * Empty input → { ok: true, value: null }. Stored form is "a@x.com, b@y.com".
 */
export function normalizeEmailListInput(value: string | null | undefined):
  | { ok: true; value: string | null; emails: string[] }
  | { ok: false; error: string } {
  const parts = splitEmailList(value);
  if (!parts.length) return { ok: true, value: null, emails: [] };
  const invalid = parts.find((part) => !isValidEmail(part));
  if (invalid) return { ok: false, error: `"${invalid.slice(0, 80)}" is not a valid email address.` };
  if (parts.length > MAX_CUSTOMER_EMAILS) return { ok: false, error: `Use ${MAX_CUSTOMER_EMAILS} email addresses or fewer.` };
  const joined = parts.join(", ");
  if (joined.length > MAX_EMAIL_LIST_LENGTH) return { ok: false, error: "That email list is too long." };
  return { ok: true, value: joined, emails: parts };
}

/** Splits a list into the main recipient and the CC list. */
export function toAndCc(value: string | null | undefined): { to: string | null; cc: string[] } {
  const emails = parseEmailList(value);
  return { to: emails[0] ?? null, cc: emails.slice(1) };
}

/** Short helper text for email inputs. */
export const CC_EMAILS_HINT = "Copied on every invoice, estimate, reminder and job notice. Separate with commas.";
