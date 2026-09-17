# Square customer payments

Customers use the owner-provided https://square.link/u/TezbYuSG link. It was fetched successfully on September 17, 2026 and identified itself as "Chill pros Invoice payment" for "Chill professionals llc", enabled and accepting payments. The checkout accepts buyer-entered amounts from $1 to $50,000. No charge was submitted.

This is a shared hosted payment link, not an OAuth/API integration. Customers enter the invoice total themselves. No invoice identifiers, amounts or customer details are sent automatically, and no Square webhook marks invoices paid. The owner must confirm the completed payment, total and customer in Square, then record payment in Chill Pros. Customers are warned not to pay again while awaiting confirmation.

## Files changed

- `lib/chillbros/square-payment.ts`: central public link and supported amount bounds.
- `components/square-payment.tsx`: shared Square button, amount, matching instructions and duplicate-payment warning; printable URL.
- `components/client-portal-actions.tsx`: replaces Stripe and manual options; requires approved, issued, unpaid invoice.
- `components/document-payment-methods.tsx`: same Square experience in emailed invoice documents; paid confirmation retained.
- `app/portal/[token]/page.tsx`: removes obsolete payment-settings query and passes the invoice total.
- `app/portal/[token]/document/page.tsx`: uses Square for unpaid invoices while preserving recorded methods on paid receipts.
- `app/settings/payments/page.tsx`: shows the Square link and reconciliation instructions instead of other provider configuration.
- `app/settings/payments/actions.ts`: removes obsolete payment-settings mutations; preserves test-email action.
- `app/api/payments/stripe/checkout/route.ts`: returns 410 instead of creating new Stripe sessions. Existing Stripe webhook remains to settle historical sessions.
- `app/invoices/new/page.tsx`: allows staff to record already-confirmed card payments and explains Square checkout.
- `app/invoices/new/actions.ts`: accepts existing card enum for those records.
- `scripts/square-payments.test.cjs`: real component rendering and endpoint regression checks.

No database changes, credential changes, or historical payment deletions. Staff can still record historical payment methods accurately.

## Validation

- 16 tests passed: 12 core workflow tests and 4 Square regression tests.
- Production build and TypeScript passed.
- Changed-file ESLint: no errors; one pre-existing unused-variable warning in direct-invoice action.
- Live authenticated invoice/owner flow and an actual Square transaction were not tested. Preview deployment may require Vercel login.
