# Core service-call workflow review

Branch: `fix/core-workflow`. Intended destination: one pull request into `main`; do not merge or push to `main` as part of this work.

Calls can move from scheduling through field work, office close-out, office invoice approval, email delivery, corrections, and payment. Saved work survives an email failure. Existing customer-signature approval remains available.

## Files changed and why

| File | Plain-English explanation |
| --- | --- |
| `app/schedule/actions.ts` | Preserve the current technician and field progress when rescheduling, reject terminal calls, ignore closed calls in conflicts, prevent recent/repeated submissions, and separate save success from email warnings. Schedule verification only reads the saved row. |
| `app/schedule/page.tsx` | Show save success and email warnings, give create-call submissions a stable ID, clarify the blank technician choice, and bypass draft interception on create/reschedule. |
| `lib/chillbros/job-admin-actions.ts` | Allow office close/cancel from every active status and report the real current status when blocked. |
| `components/dispatch-panel.tsx` | Keep Work done calls in the billing group, preserve legacy statuses in the editor, label the close action clearly, and show unexpected action errors. |
| `components/technician-job-editor.tsx` | Offer On my way, On site, and Work done while displaying legacy stages; show save failures and prevent note autosaves from changing the call's stage. |
| `lib/chillbros/job-workflow-v2.ts` | Limit new field transitions to the three guided choices, permit unchanged legacy stages, and preserve the database stage during notes-only saves. |
| `lib/chillbros/billing-terms.ts` | Share the existing approval due-date calculation between customer approval and office finalization. |
| `lib/chillbros/billing-actions.ts` | Add office finalization, manager reopening of approved/unpaid invoices, and saving a missing customer email before sending; report exact delivery failures and update active calls after successful invoice email. |
| `components/invoice-admin-controls.tsx` | Add Edit prices, Finalize & email, Reopen to edit, and Save email & send; show recipient-aware success and real errors; keep payment/receipt feedback visible after an invoice is paid. Existing finalize/email/payment buttons are `type="button"`, not intercepted form submissions. |
| `app/invoices/page.tsx` | Display the existing owner price editor for the selected editable invoice and retain payment/receipt results on the focused invoice. |
| `components/owner-estimate-editor.tsx` | Explain how to save corrections and finalize again, and show unexpected save failures. |
| `lib/chillbros/owner-estimate-actions.ts` | Explicitly lock paid invoices and instruct the owner to reopen an approved unpaid invoice before editing. |
| `lib/chillbros/job-lifecycle-actions.ts` | Replace silent failures with success/error redirects and invoice links, check database results, preserve progress during return scheduling, and audit non-blocking email/SMS outcomes. |
| `app/jobs/[id]/page.tsx` | Render lifecycle feedback and invoice links, expose office finalization, and bypass draft interception on lifecycle forms. |
| `lib/chillbros/approval-notifications.ts` | Keep Gmail SMTP, identify missing SMTP environment variables, correct the company fallback address, use valid email-log enum values, and report log-insert errors. |
| `lib/chillbros/assignment-notifications.ts` | Keep assignment email delivery, use valid email-log enum values, report logging errors and missing SMTP settings, and use preview links when running on Vercel preview. |
| `lib/chillbros/billing-delivery.ts` | Preserve delivery error details, log billing sends/failures in both existing logs, audit automatic sends, and keep preview email links on the preview deployment. Missing recipients are recorded with a nonempty placeholder required by the existing log constraint. |
| `lib/chillbros/estimate-actions-v2.ts` | Reuse approval due dates, audit automatic email outcomes, and report receipt failures without undoing recorded payment. |
| `components/form-draft-protector.tsx` | Skip every form carrying `data-no-draft` and cap submit-time remote draft flushing at two seconds. |
| `app/invoices/new/page.tsx` | Bypass remote draft interception when creating a quote or invoice. |
| `app/settings/payments/actions.ts` | Add a manager-only test using the existing sender and signed-in email, with precise errors naming missing settings. |
| `app/settings/payments/page.tsx` | Add the Send test email button and show its destination using the page's existing result messages. |
| `scripts/core-workflow.test.cjs` | Exercise real server-action code against an in-memory Data API double, covering workflow regressions without touching live data. |
| `docs/core-workflow-review.md` | Record the changes, local verification, outstanding blockers, and required preview checklist. |

## Verification

- `npm run build`: passed. Local build uses a process-only placeholder `NEON_AUTH_COOKIE_SECRET`; no credentials are committed. No live database or SMTP verification is implied by this build.
- `node --test scripts/core-workflow.test.cjs`: 12 passing regression tests, including all active close/cancel stages, preserved reschedules, concurrent repeated submissions, finalization failures, reopening guards, missing email, technician stages, lifecycle redirects, receipt failures, and log enums.
- ESLint on all changed source/test files: passed with no errors or warnings.
- `npm run lint`: **not passed**. There are 41 errors in 14 unchanged files. These are existing `no-explicit-any`, `set-state-in-effect`, `no-unescaped-entities`, and `prefer-const` failures in 3D, tech-assist, inventory, work-order, owner-command, and technician-assignment code. Full lint remains a merge blocker until the scope conflict is resolved. No lint rules were weakened or files excluded.

## Preview checklist

Preview URL: pending branch publication and Vercel deployment.

Test delivery recipient supplied by the owner: `brae.morrison93@gmail.com`. The Settings test always uses the signed-in owner's email; use the supplied address for the test customer. Use a test customer and technician on the branch preview. These checks have **not** been run against production and must not be represented as completed from local regression tests.

- [ ] Settings → Send test email → arrives.
- [ ] Schedule → create call for a test customer + tech → green success; only one call is created even if you tap twice.
- [ ] Reschedule that call after the tech taps On my way → status stays En route; tech stays assigned.
- [ ] Tech: On my way → On site → Work done with notes.
- [ ] Dispatch → Close call works from Work done (and from En route).
- [ ] Invoices → New invoice for that customer → Finalize & email → customer receives it; link opens.
- [ ] Reopen to edit → change a price → Finalize & email again.
- [ ] Mark paid → paid; receipt email arrives.
- [ ] Customer without email → Save email & send works, and the email is saved on the customer.
- [ ] `chillbros_email_log` and `chillbros_delivery_log` get rows for sends and failures.

No migrations, enum/table/column deletion or renaming, sender replacement, environment-variable renaming, theme/logo/CSS-file changes, or new product areas are included.
