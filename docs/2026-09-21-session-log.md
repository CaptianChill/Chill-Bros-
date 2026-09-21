# 2026-09-21 session log — Revenue Radar, live-data fire drill, and cleanup

This is the definitive record of everything done in this session, in order,
so nobody has to reconstruct it from PR titles later. For the deep-dive on
which database is actually live and how that was proven, see
`docs/database-source-of-truth.md` — this file summarizes and links out
rather than repeating it.

## 1. Revenue Radar Battle Card (PR #122)

Rebuilt the Revenue Radar lead list to render each lead as a structured
Battle Card — Business, Decision-Maker, Why Now, Evidence, Recommended
Offer, Estimated Opportunity (ONE-TIME vs RECURRING), Next Action — computed
in `lib/chillbros/battle-card.ts` purely from data already on the row
(category, service_line, signal_summary, contact_*, source_url,
verification_status, recorded revenue). Nothing invented: a lead with no
verified trigger is labeled "Generic discovery lead" and shows "Research
pending" instead of manufactured detail; a lead backed by a real TDLR/news
signal is labeled "Verified high-intent lead." Added New/Hot/All tabs and
Highest Score / Newest / Most Urgent sorting to `components/revenue-radar-list.tsx`.

Also root-caused and fixed a silent lead-cutoff bug: the list query was
capped at `.limit(100)`, then found to still be capped after raising that
(a hidden Data API row cap on Neon, since resolved to be moot — see below).
Fixed for good by fetching in small paged batches (`app/revenue-radar/page.tsx`,
50 rows/request via `.range()` with an `id` tiebreaker for deterministic
ordering across tied scores) instead of one large request — this works
regardless of any hidden per-request cap, on either database.

## 2. The database mistake, caught and corrected (PRs #123–#126)

Spent several hours diagnosing "leads don't show up" and "not enough
inventory" bugs against the Neon project `calm-recipe-99461264` ("Chill
Bros"), including real fixes (pagination, a `track_inventory` column,
`db_max_rows` config). All of it was applied to a database production does
not actually use.

**What actually happened:** the app's live `SUPABASE_URL` points to a
Supabase project named `bbb-sports-intelligence` (id `xespxlqcjvhompsxranc`)
— a deliberately unrelated-looking name that turned out to be the real,
full production backend (all 34 `chillbros_*` tables, real customers, real
invoice history). The Neon project is a migration target from an
attempted-and-reverted cutover (git history has a commit literally titled
*"Revert 'Enforce Neon as the single Chill Bros backend'"*). Both databases
carry overlapping Revenue Radar seed data, which is exactly what made the
wrong-database mistake possible — a read-only data match looked
reassuring and was misleading.

**How it was actually proven**, once suspicion set in: inserted a
uniquely-named test row into Neon, asked the owner to check the live app —
not there. Then matched a real production error
(`invalid input value for enum chillbros_job_status: "new"`) against each
database's actual enum — only Supabase's narrower 4-value enum explains it.
Then found a real paid invoice (`I-002`, customer Sammy) existing in
Supabase and nowhere in Neon, at any timestamp, by any search. Full
methodology in `docs/database-source-of-truth.md`.

Fixed as a result:
- Renamed `docs/neon-source-of-truth.md` → `docs/database-source-of-truth.md`
  (the old name was itself part of the trap) and rewrote it with the
  corrected identity, the proof method, and known decoy projects.
- Corrected `docs/neon-cutover-status.md`, which wrongly claimed cutover
  was complete.
- Committed `CLAUDE.md`/`AGENTS.md` (previously untracked — a fresh session
  would never have seen any of this) with the warning surfaced at the very
  top of `CLAUDE.md`.

## 3. Real fixes, applied to the real database (PRs #124, #127, #128)

All of these are schema/data changes made directly against
`xespxlqcjvhompsxranc` — no app deploy needed for them to take effect,
though the app code was also updated where it reads/writes the new column.

- **"Not enough inventory" on Labor/Service Charge/Trip charge.** These
  were stored in `chillbros_parts_catalog` — the same table as real
  stocked parts — with no way to tell them apart from a genuine part except
  a `part_number` prefix convention (`PB-` = price book) that didn't cover
  them. Added a real `track_inventory` boolean column (backfilled `false`
  for price-book rows and the three billing items, `true` for everything
  else — only R22 refrigerant is genuinely stock-tracked), and updated the
  `chillbros_add_job_part` / `chillbros_set_job_part_quantity` Postgres
  functions to respect it. Also swapped the same prefix-heuristic in six
  app-code call sites (`app/invoices/new/actions.ts`,
  `lib/chillbros/queries.ts`, `lib/chillbros/inventory-intelligence.ts`,
  `lib/chillbros/report-queries.ts`) to use the real flag — these were also
  incorrectly counting Labor/Trip charge in inventory-value and low-stock
  reports before this.
- **`invalid input value for enum chillbros_job_status: "new"`.** The real
  database's enum only had 4 values; the app's `JobStatus` type
  (`lib/chillbros/types.ts`) expects 19. Added the missing 15 directly.
- **"Add employee" FK error.** `chillbros_profiles_id_fkey` required `id`
  to reference Supabase's own `auth.users`, but new logins are created via
  Neon Auth, whose ids can never satisfy that. The app's real session check
  already only matches on `auth_user_id`, never `id`, so the constraint was
  dead weight from before the Neon Auth changeover. Dropped it — pure
  restriction removal, no data touched.
- Improved the invoice "not enough inventory" error to name the specific
  part and the requested-vs-available quantity, so any future occurrence
  is immediately actionable without a database lookup.

**Known, deliberately unfixed:** most existing employee profiles have
`auth_user_id = null`, meaning they likely can't sign in via the app's real
session check today except through the hardcoded owner-email bypass. This
looks pre-existing, not caused by anything this session. Flagged in
`docs/database-source-of-truth.md` — needs a deliberate decision (Supabase
Auth vs. Neon Auth for employee logins), not a guessed fix.

## 4. Customer-facing branding: "Chill Bros" → "Chill Pros" (PR #129)

The invoice email (subject, body, and the sender name shown in the
customer's inbox), job-status update emails, the payment receipt and
service-agreement document headers, and the approved-work copy on the
customer portal all said "Chill Bros." Fixed in `lib/chillbros/billing-delivery.ts`,
`lib/chillbros/customer-communications.ts`, `lib/chillbros/approval-notifications.ts`,
`lib/chillbros/invoice-pdf.ts`, and the portal/agreement pages under
`app/portal/[token]/` and `app/agreement/[token]/`.

Deliberately scoped to genuinely customer-facing text only. There are
~50 other files where "Chill Bros" appears in internal/staff-only pages
(dispatch, dev tooling, admin screens) that were left alone — that's a
much larger rebrand nobody asked for here, not an oversight.

## 5. Domain/DNS: `chillprostx.com` is not pointed at Vercel

A customer invoice email's "Open invoice" link landed on an unrelated
freelancer's portfolio site instead of the app. Traced to: `chillprostx.com`
is registered externally (not through Vercel) and its nameservers are still
`ns1/ns2.dns-parking.com` — the registrar's default "unconfigured" parking
service, never pointed at Vercel. Confirmed via Vercel's own domain record:
`configVerifiedAt: null`, `nsVerifiedAt: null`, `intendedNameservers: []`,
vs. the account's other working domain (`bidlume.app`), which shows real
verification timestamps and `ns1/ns2.vercel-dns.com`. This is not something
fixable from here — it requires the owner's registrar login.

**Temporary workaround, live now:** set `NEXT_PUBLIC_APP_URL=https://chill-bros.vercel.app`
as a new production env var (id `RHifk8aA0QHK9Ddo`) and redeployed
(`dpl_HoFDgYmWt1C3y5o2Q7hG67GfXEox`, confirmed `READY`). Every customer
link (invoice email, portal, receipt, agreement) now points at
`chill-bros.vercel.app` — the only real Vercel-provided domain for this
project (there is no `chillbros.vercel.app` without a hyphen; that
subdomain isn't this project's). Confirmed working by the owner sending a
real customer invoice.

**To do once `chillprostx.com`'s DNS is actually fixed:** delete the
`NEXT_PUBLIC_APP_URL` production env var (or update it back to
`https://chillprostx.com`) and redeploy, so links go back to the real
domain instead of the `.vercel.app` one. Until then, this override is
intentional and correct — don't "clean it up" without doing the domain fix
first, or customer links break again.

## State as of end of session

- Revenue Radar Battle Card: live, working, correct data source.
- Inventory-tracking bug: fixed on the real database.
- Job-status enum bug: fixed on the real database.
- Add-employee bug: fixed on the real database.
- Customer-facing branding: fixed and deployed.
- Domain: working around a real DNS gap with a Vercel subdomain; the actual
  fix is on the owner to complete at their registrar.
- Open, not addressed this session: most employee accounts likely can't
  sign in via the real session check (pre-existing); ~50 files with
  internal-only "Chill Bros" text (out of scope, not a bug).
