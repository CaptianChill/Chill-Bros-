# Lead marketplace continuation checkpoint

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
