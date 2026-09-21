# Chill Pros database — source of truth (CORRECTED 2026-09-21)

> **This file was originally written earlier today and got the central
> answer wrong.** It said the live database was Neon. It is not. Everything
> below was re-verified from scratch against real production traffic and
> real customer data after that mistake caused real damage (fixes applied
> to a database nobody reads from, while the live app kept failing). Trust
> this version; if you're reading an old copy, throw it out.

> **Naming note:** the business is **Chill Pros** (Vercel team `chill-pros`,
> domain `chillprostx.com`, owner email `chillprostx@gmail.com`). The GitHub
> repo, both database projects below, and the `chillbros_*` table prefix all
> say "Bros" instead — legacy naming, not a different product.

## The one real, live database

- **Platform: Supabase — not Neon.**
- **Project name:** `bbb-sports-intelligence` — yes, that name is
  completely unrelated to HVAC/Chill Pros and looks like a decoy. It isn't
  one. This is the real backend.
- **Project ID:** `xespxlqcjvhompsxranc`
- **Org:** `Boodavelli Org` (`addvjskzmmshaxmfmris`)
- **Schema:** all 34 `chillbros_*` tables live here — `chillbros_customers`,
  `chillbros_jobs`, `chillbros_invoices`, `chillbros_parts_catalog`,
  `chillbros_revenue_prospects`, all of it. This is a full, real production
  database with real customers, real invoices, real job history.
- Vercel's production `SUPABASE_URL` / `SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY` point here. (Vercel will not let even an
  authorized session decrypt and display these values directly — that's a
  platform restriction, not something worth fighting. Verify by data match
  instead, see below.)

### How this was actually proven (read this before trusting any other check)

Matching seed data is **not enough** — `chillbros_revenue_prospects` has
near-identical rows in *both* this database and the Neon project below
(same business names, same scores), because Revenue Radar's scan data was
seeded into both at some point. A read-only match will fool you. What
actually proved this database is the live one, on 2026-09-21:

1. **Write test.** Inserted a uniquely-named test row into Neon's
   `chillbros_customers`. Asked the owner to check the live app's Customer
   Center. It was not there. The owner's real customer list (Sammy, Nordstrom,
   Blah blah, El Regio Tacos, etc.) exists only in `xespxlqcjvhompsxranc`.
2. **Enum mismatch.** The live app threw
   `invalid input value for enum chillbros_job_status: "new"`. Neon's
   `chillbros_job_status` enum has 19 values including `new`. This Supabase
   project's enum has exactly 4: `scheduled`, `in_progress`, `completed`,
   `cancelled` — `new` isn't one of them. The live error only makes sense
   against this database.
3. **Missing writes.** A real invoice (`I-002`, customer "Sammy", $2,245,
   line items "return trip," "labor," "spark ignitor/pilot assembly") was
   created and paid through the live app. It does not exist anywhere in
   Neon's `chillbros_invoices`/`chillbros_jobs` — not by number, not by
   customer name, not by any distinctive line-item text, at any timestamp.
   It exists in this Supabase project with matching data.

**The reliable check going forward is #1's shape, not a data read:** write
something uniquely identifiable to whichever database you're inspecting,
then ask the owner (or check via the live app) whether it shows up. A
matching row you only *read* proves nothing given both databases currently
carry overlapping seed data.

## The other database — Neon "Chill Bros" (`calm-recipe-99461264`)

This is real, but **it is a migration target that production does not
currently read or write to for core data** (customers/jobs/invoices/parts).
Full details on this project (branches, decoy projects near it, the
`db_max_rows` Data API gotcha) are still accurate and kept below — they're
just not about the live database.

- The repo's own git history has a commit literally titled *"Revert
  'Enforce Neon as the single Chill Bros backend'"* — a migration to Neon
  was attempted and rolled back. This explains the split state.
- **Auth is a partial exception.** `lib/auth/server.ts` hardcodes a Neon
  Auth endpoint (`NEON_AUTH_BASE_URL`, defaulting to
  `ep-jolly-field-ay0y9fdh.neonauth...`) independent of `SUPABASE_URL`. So
  sign-in/session handling may genuinely run through Neon Auth while the
  actual business data it authenticates access *to* lives in Supabase. This
  split hasn't been fully verified end-to-end — treat it as a known risk,
  not a confirmed-safe split, until someone checks it deliberately.
- Revenue Radar prospect data (`chillbros_revenue_prospects`) exists in
  *both* databases with overlapping rows, for reasons not yet understood —
  possibly a scan job that wrote to both at some point, or a partial data
  copy during the abandoned migration. Don't use this table alone to decide
  which database is live.

Project details for reference:
- Neon project: `Chill Bros` — id `calm-recipe-99461264`
- Branch: `main` — id `br-snowy-frost-ay6w5d8y`, database `neondb`
- Compute endpoint: `ep-jolly-field-ay0y9fdh`

## Known decoys — genuinely not either of the above

Checked directly and confirmed empty/unrelated:

| Platform | Name | Why it's not it |
|---|---|---|
| Neon | `chill-pro-made` (`calm-mud-93982933`) | Unrelated schema: `jobs`, `labor`, `change_orders`, `equipment_and_parts`, `estimate_versions`. No `chillbros_*` tables. |
| Neon | `Chill pro Q3D` (`restless-math-36137941`) | `public` schema completely empty. |
| Supabase | `alpha-hunter` (`nhpybnubeyqxattzkaoh`) | No `chillbros_*` tables. Unrelated app, same org. |

## Work applied to the wrong database on 2026-09-21 — needs redoing on Supabase

Before this was caught, the following fixes were applied to Neon
(`calm-recipe-99461264`) believing it was live. **None of these have taken
effect in production.** They need to be re-applied against
`xespxlqcjvhompsxranc` (or abandoned if the Neon migration is picked back up
instead — that's the owner's call, see the note below):

1. Revenue Radar Battle Card UI changes (`components/revenue-radar-list.tsx`,
   `lib/chillbros/battle-card.ts`) — these are pure app-code changes and
   *are* live in production (they don't depend on which database backs
   them), but the row-limit/pagination fix and `db_max_rows` Data API
   config change were Neon-specific and do nothing for the real database.
2. `chillbros_parts_catalog.track_inventory` column + the
   `chillbros_add_job_part` / `chillbros_set_job_part_quantity` Postgres
   function fixes (the "Not enough inventory" bug) — schema and RPC changes,
   applied only to Neon. **Confirmed Supabase does not have this column.**
   The app code was still updated to reference `track_inventory` in
   `app/invoices/new/actions.ts` and elsewhere — against Supabase, where
   that column doesn't exist, this likely makes the inventory check silently
   no-op (selecting a nonexistent column returns nothing usable, so
   `row.track_inventory` reads as falsy for every part, so no part ever gets
   flagged as inventory-tracked) rather than working correctly. This needs
   verification and a real fix on Supabase, not just re-running the same
   migration there.

## Before doing anything else in a new session

1. Read this file first.
2. Do not trust a matching data read between the two databases as proof of
   which is live — prove it with a write test if there's any doubt.
3. Assume Supabase (`xespxlqcjvhompsxranc`) is where fixes belong, unless
   the owner says the Neon migration is back on and confirms `SUPABASE_URL`
   has been repointed.
4. If the owner mentions completing "the migration" to Neon, that means
   finishing what the reverted commit started — cleanly moving all
   `chillbros_*` tables' *live* data and env vars over, not assuming it's
   already done.
