# Staff account management

Owner controls at /owner now provide Add employee, Change password, Delete employee, and Remove all employees except owner. The owner can choose a 12–128 character password or leave it blank to generate one. Password forms are excluded from draft storage. Missing unlinked logins can be provisioned through Change password; database read errors are no longer mislabeled as missing employees.

Deletion verifies the owner session and employee login identity, protects owner profile ID/email/auth ID, deactivates access, removes the Neon login, and retires the staff profile under a non-deliverable address. Profile IDs and names remain to preserve job/invoice/time history; no business records are deleted. Removed profiles are excluded from the staff account list and cannot be reactivated. The original email can be used for a new employee. Auth failures leave a visible inactive profile for retry; bulk removal reports partial failures.

Files:
- components/manager-user-panel.tsx: simplified owner controls, password forms and deletion confirmations.
- lib/chillbros/mutations.ts: custom passwords, missing-login repair, owner protection, actionable errors and owner-page refresh.
- lib/chillbros/staff-delete-actions.ts: individual and bulk removal with owner protection and partial-failure reporting.
- lib/chillbros/queries.ts: exclude retired accounts and surface staff-query errors.
- scripts/staff-accounts.test.cjs: seven server-action regressions covering authorization, owner preservation, login removal, historical preservation, partial failures, missing-login repair and password validation.

Validation: staff tests passed; existing 17 workflow/payment tests passed; TypeScript, changed-file lint and production build passed. Live authenticated staff mutations were not executed because the coding session has no signed-in owner session or production database credentials. Existing production employees have NOT been removed. The owner must execute the bulk removal in the deployed Owner Control Center. No claim is made that Eric's exact production error has been reproduced; the previous generic error obscured its cause.
