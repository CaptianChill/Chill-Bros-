# Provider setup and acceptance — November 5, 2026

Status: blocked pending provider accounts/credentials and GitHub billing resolution. Sales and outreach remain OFF; global approval hold remains ON. Test recipient authorized by owner: chillprostx@gmail.com. This address does not identify a Google Cloud project or Microsoft Entra tenant.

## Verified configuration

Vercel team `chill-pros`, project `chill-bros-` (`prj_PhQvuJOVigfQZpnx71re7o1rnGpl`), PR #288 head `946152898a2aab0b35c9ca688efce28f1c0a4404`, READY preview `https://chill-bros-7fwcp12zb-chill-pros.vercel.app`.

Project environment metadata shows no `LEAD_MARKET_*` settings. Square token/location and company Gmail SMTP settings exist only for production. Preview has Supabase credentials but cannot currently send buyer sign-in codes or create Square checkout. Credentials being present in production is not evidence that marketplace flows work. No secrets were retrieved or copied.

Live Supabase `xespxlqcjvhompsxranc`: zero buyers, listings, orders and mailbox connections; seller identity blank, terms/tax unreviewed, sales false, outreach false, global hold true.

## GitHub blocker

Run [42044037425](https://github.com/CaptianChill/Chill-Bros-/actions/runs/42044037425) was retried on November 5. Latest job `127333435225` failed before any steps. The visible annotation states: “The job was not started because your account is locked due to a billing issue.” The account owner must resolve the billing lock; then rerun failed jobs. Do not skip checks, replace their status, or infer a source-code failure from this pre-start failure.

## Configure an isolated acceptance environment

Use a separate test database for disposable buyer/order fixtures. The current preview points to the live database; do not enable live sales/outreach for testing. Do not expose production Square or company mailbox credentials in preview. Register a stable HTTPS test origin, set `LEAD_MARKET_APP_URL` to exactly that origin, and redeploy after environment changes. OAuth cookies and callback must remain on that same origin. Existing invoice URLs must remain unchanged.

| Setting | Required purpose |
| --- | --- |
| `LEAD_MARKET_APP_URL` | Stable HTTPS origin for callback, checkout returns and opt-outs |
| `LEAD_MARKET_SECRET` | Dedicated server-only session/encryption secret; set before connecting mailboxes and retain it |
| `LEAD_MARKET_GOOGLE_CLIENT_ID`, `LEAD_MARKET_GOOGLE_CLIENT_SECRET` | Google web application credentials |
| `LEAD_MARKET_MICROSOFT_CLIENT_ID`, `LEAD_MARKET_MICROSOFT_CLIENT_SECRET` | Microsoft web application credentials |
| `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD` | Test-only company transport for buyer sign-in codes |
| `SQUARE_ENVIRONMENT=sandbox`, `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID` | Matching Square Sandbox credentials/location, test environment only |

Enter secrets directly in the provider/Vercel settings; never paste them in chat or commit them. Changing the existing encryption secret after connections exist requires a migration or reconnect, since it also signs buyer sessions and opt-outs.

## Google

Owner must select the owning Cloud project. Enable Gmail API and configure OAuth branding/audience with truthful seller identity and reviewed privacy/terms URLs. Create a Web application client. Register the exact redirect URI `<LEAD_MARKET_APP_URL>/api/lead-market/oauth/callback`; add the authorized tester while the app is in testing. Current code requests `openid email https://www.googleapis.com/auth/gmail.send`, PKCE, state and offline access. `gmail.send` is a sensitive scope; public availability requires the applicable Google verification. Connect using the buyer mailbox and verify the displayed email matches the consented account.

References: [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

## Microsoft

Owner must select the Entra tenant and register a Web application with account audience appropriate to the supported business/personal mailboxes. Current code uses the `common` endpoint. Register the same callback path above. Configure delegated `User.Read` and `Mail.Send`, plus `openid email offline_access`; complete tenant/admin consent when required. Store app credentials in the matching test environment. Confirm identity, token renewal and disconnect using a real test account before advertising support.

Graph returns 202 for accepted sending; that does not confirm completed processing or inbox delivery. Reference: [Graph sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0).

## Acceptance evidence required before launch

1. Buyer email-code request reaches the authorized test inbox through the application transport. Verify code, register a buyer, sign out/in, and confirm buyer identity grants no staff access. Verify expired/replayed codes fail.
2. Authenticated owner opens operations, moderates the fixture buyer, and can read orders/claims. A second buyer cannot read/export the first buyer's order or mailbox.
3. In the isolated database only, publish a clearly synthetic offer with fixture evidence and approved fixture price/tax/terms. Square Sandbox checkout returns to the same origin; verified provider payment delivers once. Exercise repeated checkout, mismatched amount, reservation expiry/late payment, refund and refund reconciliation. Never submit a real card. Use [Square Sandbox testing](https://developer.squareup.com/docs/devtools/sandbox/testing).
4. Google, Microsoft and TLS SMTP each connect and send one explicit test message to the authorized inbox. Check Sent and actual recipient receipt, provider identity, renewable access and disconnected-account failure. SMTP verification alone does not prove sending authority or delivery. No customer prospects may be recipients.
5. Execute one-introduction automation only with isolated synthetic inventory and the authorized test recipient. Confirm opt-out blocks later sends/exports, holds block transport, uncertain acceptance cannot auto-retry, and caps/reservations prevent duplicates. Restore all test holds after exercising success paths.
6. Record timestamps, deployment SHA, environment, provider IDs (no secrets), sanitized results and receipt evidence. Keep provider acceptance pending until these observations exist. Then obtain seller identity, reviewed tax/terms, real inventory resale rights, pricing and qualification evidence before opening sales; outreach additionally needs buyer consent and all sender/global gates.

## Validation observed this continuation

Nine marketplace unit/provider contract tests, 76 Radar tests, 19 frozen payment tests, TypeScript, full ESLint (13 warnings, zero errors), and both isolated PGlite database suites pass. Dependency audit exits successfully at the CI high-severity threshold: seven low findings remain in the auth UI dependency chain. The real provider and authenticated hosted flows above are still pending. These local checks do not clear the GitHub billing lock or establish launch readiness.
