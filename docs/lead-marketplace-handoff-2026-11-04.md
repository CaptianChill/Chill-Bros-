# Lead marketplace continuation checkpoint

## November 5 continuation — CI cause confirmed, providers blocked

GitHub run 42044037425 was retried; latest job 127333435225 again failed before steps. Browser annotation explicitly confirms account lock due to billing. Owner must resolve GitHub billing, then rerun failed jobs; no bypass or production release occurred.

Actual Vercel project name is `chill-bros-`, ID `prj_PhQvuJOVigfQZpnx71re7o1rnGpl`, team `chill-pros`. Metadata confirms no marketplace Google/Microsoft OAuth variables, marketplace base URL or dedicated marketplace secret. Square and company SMTP credentials are production-only, so the preview cannot currently complete checkout or email-code sign-in. No secret values were read/copied. Owner supplied `chillprostx@gmail.com` as acceptance inbox; owning Cloud project/Entra tenant remain unspecified.

Read `docs/lead-marketplace-provider-acceptance.md` for exact environment variables, callback path, account setup and acceptance evidence. Do not enable the live database's sales/outreach to create test fixtures. Latest live read confirms both false, global hold true, zero buyers/listings/orders/mailboxes, blank seller identity and unreviewed terms/tax.

Added two provider contract tests: OAuth identity/renewable grants and SMTP mixed-private DNS/TLS pinning. All 9 marketplace tests, 76 Radar tests, 19 frozen payment tests, TypeScript, full lint (13 warnings, no errors), and both isolated PGlite SQL suites pass. Network-enabled npm audit passes high-severity threshold with seven low auth-UI-chain findings. Real authenticated owner/buyer, Square and mailbox acceptance remain pending. No messages, charges, source inventory or launch approvals were created.

## November 5 update — supersedes the earlier unfinished-code list below

Local commit `9461528` implements the buyer storefront at `/leads`, email-code buyer identities/sessions separate from staff, catalog/access requests, locked shared/exclusive order reservations, Square checkout/recovery/reconciliation/refunds, protected delivery and CSV export, outcomes/quality claims, buyer OAuth/TLS SMTP connections, signed opt-outs, capped one-introduction automation, and owner console `/owner/lead-market`. Brand and marketplace base URL are configurable separately from invoice URLs. Existing invoice payment code is unchanged.

Migration `20261105022644_lead_marketplace_v1.sql` HAS NOW BEEN APPLIED to Supabase `xespxlqcjvhompsxranc`. Live checks: zero buyers/offers/orders, market sales false, market outreach false, global approval hold true, RLS enabled and anonymous order access revoked. Do not turn on sales/outreach or invent inventory/prices. Seller brand/domain/email, reviewed tax/terms, qualified resale-permitted inventory, real provider checkout/mailbox testing and Google/MS OAuth app credentials still need completion before claiming commercial launch readiness.

Validation now passed: 7 marketplace unit tests, 76 Radar tests, 19 frozen payment tests, TypeScript, new-code ESLint, and isolated PGlite 0.5.15 SQL tests covering shared/exclusive capacity, buyer/identity isolation, OTP attempt/replay limits, atomic checkout claims, verified settlement/idempotency, tax rounding, late-payment refund handling, changed/expired permissions, opt-outs and ambiguous-send retry prevention. The short-lived Vercel test environment was stopped. No real emails, charges or customer-data fixtures were created during tests.

Publication authorized by owner ("of course") and succeeded. PR #288 head is 946152898a2aab0b35c9ca688efce28f1c0a4404. Vercel deployment dpl_5R4FhvG6jC1he9UsbC1gPUzfvFoc is READY: https://chill-bros-7fwcp12zb-chill-pros.vercel.app/leads . Browser verified storefront, empty catalog and signed-out account redirect to working sign-in screen. No code email sent. GitHub Security audit run 42044037425 failed; job 127302055379 has no steps and logs return BlobNotFound. Cause remains unverified; do not bypass CI or claim production release. Authenticated buyer, owner, payment and mailbox acceptance still pending. Next: investigate Actions failure, complete provider setup and end-to-end acceptance, then release through normal checks. Sales/outreach remain off.

Latest usage note from owner: approximately 83% at resume; exact remaining usage is not visible to the agent. Keep updates concise and provide a fresh checkpoint if stopping.

## Owner's requested outcome and preferences

Build a complete lead-selling software platform as soon as practical. This is a separate software/lead business, not merely Chill Pros' internal service-company sales tool. No buyers exist yet: provide public marketing, self-service buyer registration, and owner moderation. Buyers must use their OWN sending mailboxes. Support Google/Workspace, Microsoft/Outlook and authenticated SMTP where supported; do not promise literally every mailbox or bypass provider OAuth/admin requirements. Pricing is undecided: make editable and keep paid offers unpublished until prices and inventory are approved. Owner prefers free/low-cost data and verification options initially. They asked for concise communication and a handoff prompt because of usage/overage concerns. Brand and domain are not chosen; do not register anything or invent a verified business identity.

## Important truthful status

The complete marketplace is NOT finished, tested, released or ready to take payments. Do not say otherwise. Only the qualification database gate is currently applied. Buyer mailbox connections, live verified lead inventory, source resale rights, pricing/tax setup and customer results are not established. No customer outreach was sent during this work. Global outreach hold remains true, cold email disabled at last read.

## Repository, database, deployment

- Repo: C:/Users/big42/OneDrive/Documents/ChatGPT/Revenue Radar/repo
- Branch: feat/radar-outreach-evidence-policy
- Remote: CaptianChill/Chill-Bros-
- PR #288: https://github.com/CaptianChill/Chill-Bros-/pull/288 (draft/open at last check)
- Committed qualification head: acee877415a441ce2af7ddc33843f7dbba0b1bc2
- Preview: https://chill-bros-fmn8elv60-chill-pros.vercel.app (READY at that head)
- Production last checked: a28a77c7412a537dee741d7d6a9751af3cfab492, before #288.
- Actual live database: Supabase xespxlqcjvhompsxranc. Read AGENTS.md, CLAUDE.md and docs/database-source-of-truth.md before changing data.
- Existing invoice/customer Square payment files are frozen. The new marketplace commerce module is separate; do not casually modify the working invoice checkout/webhook/portal or payment tests. Keep test:payments in build.

## Completed qualification work

Applied migrations 20261104184808_radar_outreach_policy_v1.sql and 20261104190829_radar_outreach_policy_hardening.sql. Adds private sender/review tables, append-only review privileges, exact snapshots, manager reviews, 30-day contact/source expiry, 7-day confirmed-need expiry, duplicate/customer/suppression checks and reservation-time enforcement. Buyer scopes do not inherit Chill Pros approval or transport. Manager screen: /revenue-radar/[id]/qualification. Fixed cold copy does not invent buying intent. High-fit list label replaces misleading hot-lead wording.

Validation: 72 Radar tests before merging then-current main; 17 targeted policy/safety/sales-prep tests afterward; 19 frozen payment tests; initial changed-file ESLint. Hosted preview build passed. SQL positive/negative matrix passed in isolated PGlite 0.5.15 on Vercel Sandbox; environment stopped. Live read-only checks confirmed hold, private RPCs, and no review UPDATE/DELETE privileges. Live rollback-only test was not executed because connector confirmation expired twice. Authenticated browser QA remains unobserved: CUA timed out twice; preview HTTP reaches app sign-in. GitHub Actions failed with no steps/logs; do not claim billing as the reason without evidence. No production app release has occurred.

## New marketplace implementation started — UNTESTED, UNAPPLIED

New local files:
- supabase/migrations/20261105022644_lead_marketplace_v1.sql (CLI-generated filename; not applied)
- lib/lead-market/rules.ts
- lib/lead-market/store.ts
- lib/lead-market/commerce.ts

The SQL proposes isolated buyers linked to verified customer email-code accounts, listings, buyer-specific approval requests, locked inventory reservations, orders, immutable delivered snapshots, refund claims, outcomes, encrypted mailboxes, suppressions, send receipts, and events. Sales/outreach default OFF; prices default zero/unpublished; tax review is required. Exclusive = one buyer; shared cap <=5. Existing orders lock listing price/license terms. Sale qualification is separated from outbound-mailbox readiness but still requires fresh sender-specific resale/sharing evidence and suppression/customer/duplicate exclusions. Settlement rechecks rights and marks late/unfulfillable payments refund_required rather than over-delivering.

Commerce draft uses existing Square credentials in a NEW module. It creates hosted payment links, verifies actual Square orders/payments rather than trusting return parameters, and proposes cancellation/refunds. It still needs review and tests for concurrency, idempotency/recovery of an ambiguously created payment link, cancellation/payment races, tax handling and refund reconciliation. It has NOT created a real checkout or charged anyone. Reconciliation cron and user interface are not written.

An npm command was started to promote already-present transitive nodemailer 10.2.1 to a pinned direct dependency with --package-lock-only --ignore-scripts. Inspect package.json/package-lock.json and process completion before proceeding. No type declarations were added. The new handoff document itself is not yet committed. Leave unrelated supabase/.temp/ untracked.

## Next implementation steps

1. Confirm brand/email choice with owner; use a neutral configurable brand in code while undecided. Avoid misleading claims of a proven competitive edge or flawless automation.
2. Review and fix marketplace schema/core code, then implement buyer public landing/catalog, email-code signup, buyer account/order/delivery/CSV/claim/outcome UI, owner listing/buyer/sales/refund controls, and navigation. Proxy must allow /leads and /api/lead-market while each action/route authenticates and enforces buyer ownership. Never expose raw prospect/contact data in public listings or another buyer's orders. Reuse email-code identity carefully without granting staff roles.
3. Implement encrypted buyer mailbox credentials, provider-verified sender identity, OAuth state/PKCE and token refresh for Google/MS, TLS SMTP with public-IP DNS checks and pinned destination, disconnect/test controls. Provider app credentials/approvals are not configured. Do not store raw secrets or send them to browsers/logs.
4. Outbound v1 design: one fixed introductory email per purchased qualified prospect/inbox per buyer, no invented need, buyer postal address and signed opt-out, hard global/market/buyer holds, daily caps, atomic reservations, and ambiguous sends retained for review instead of automatic duplicate retries. Do not automatically follow up without reliable reply/opt-out monitoring. Implement suppression propagation to future views/exports/outreach.
5. Add bounded reconciliation/outreach cron and owner launch-readiness display. Check confirmed provider integrations rather than historical seed data. Do not unlock sales until actual prices, rights, quality checks and tax/terms are reviewed.
6. Test cross-buyer authorization, shared/exclusive capacity and races, verified payment settlement/idempotency/refunds, opt-outs, expiry, CSV injection, token encryption/AAD, SMTP SSRF and no-send-on-failure. Use isolated PostgreSQL for fixture tests. Run Radar/payment tests, TypeScript, changed-file lint and production build, then authenticated hosted QA before claiming readiness.
7. Update PR title/body around the final marketplace scope, resolve actual CI issues, release under existing authorization when verified, and report precisely what is live vs waiting on owner/provider setup. Do not stop at a static mockup or call the unfinished module a complete platform.

## Provider research already communicated

- Google Maps key is not required. Places matching does not verify buying intent; Google restricts storing/exporting Maps content for external resale. https://cloud.google.com/maps-platform/terms
- Recommended evaluating business-data licensing with explicit resale/export permission, not buying an ordinary internal-use API plan. Data Axle licensing offering was researched but no agreement/keys exist. https://www.data-axle.com/data-solutions/data-licensing/
- ZeroBounce API can validate email statuses but cannot establish purchasing authority/intent or zero errors. Free offer advertises 100 monthly checks for eligible business/premium-domain signup; owner's Gmail may not qualify. https://www.zerobounce.net/pricing ; https://www.zerobounce.net/docs/email-validation-api-quickstart
- Overture Places was identified as a possible free business-matching source. Official docs say Places carries CDLA-Permissive-2.0, Apache-2.0 and CC0 source licenses and no OSM data; retain source/license notices and independently review intended redistribution. It is not a complete contact list or verified buyer intent. Not integrated yet. https://docs.overturemaps.org/guides/places/
- Apollo's ordinary terms prohibit sharing/reselling its data. Avoid treating inexpensive contact subscriptions as automatic resale licenses.
- Competitor superiority and profitable pricing remain unproven. Do not equate 2,485 raw prospects with qualified saleable leads; audit showed 239 emails, 997 with email/phone, 63 signal-verified flags, and no demonstrated actual-revenue attribution.
