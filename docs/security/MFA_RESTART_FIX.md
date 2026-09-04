# Manager MFA enrollment restart hotfix

Issue observed: Supabase retained an abandoned unverified TOTP factor named `Chill Bros Manager`. The app attempted to reuse the same friendly name on every restart, causing `mfa_factor_name_conflict` (HTTP 422) before the QR code could be displayed.

Fix:
- stale unverified manager factor was removed from the production auth project;
- new enrollments use a unique friendly name;
- pending factors are verified directly with `challengeAndVerify` instead of requiring `listFactors()` to surface an unverified factor first;
- manager AAL2 enforcement remains enabled.

No verified MFA factor is removed or bypassed by this fix.
