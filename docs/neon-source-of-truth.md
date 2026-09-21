# Chill Pros database — source of truth

> **Naming note:** the business is **Chill Pros** (Vercel team `chill-pros`,
> domain `chillprostx.com`, owner email `chillprostx@gmail.com`). The GitHub
> repo, the Neon project name, and the `chillbros_*` table prefix all say
> "Bros" instead — that's a legacy naming mismatch baked in early, not a
> different product. Everywhere below that says "Chill Bros" or `chillbros_*`
> is quoting the actual, literal name of that repo/project/table as it exists
> today — not a typo to silently correct.

This exists because the account this app runs under has several similarly-named
Supabase and Neon projects, and it's easy to burn time re-investigating which
one production actually uses. Check here first.

## The one real database

- **Platform:** Neon (not Supabase — see below)
- **Project:** `Chill Bros` — project id `calm-recipe-99461264`
- **Branch:** `main` — branch id `br-snowy-frost-ay6w5d8y`
- **Database:** `neondb`
- **Compute endpoint:** `ep-jolly-field-ay0y9fdh` (this exact id is hardcoded as
  the `NEON_AUTH_BASE_URL` fallback in `lib/auth/server.ts` — if you ever need
  to re-confirm which Neon project is live without touching secrets, that's
  the fastest way)
- **Schema:** the `chillbros_*` prefixed tables in the `public` schema, plus
  `neon_auth.*` for auth (accounts/sessions/users)
- Vercel production env vars `SUPABASE_URL` / `SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY` point at this project's Data API. The
  `@supabase/supabase-js` client library is still used in code, but it talks
  to Neon's Supabase-compatible Data API, not an actual Supabase project.

To independently verify you're looking at the right database from a fresh
session: query `select business_name, score from public.chillbros_revenue_prospects
where business_name in ('Asia Market','McCullough Grocery')` — these should
both come back with `score = 72`. If they don't, you're on the wrong project.

## Known decoys — do not confuse these with the real thing

The account has several other Supabase/Neon projects with similar names.
Checked directly (2026-09-21) and confirmed **none of these hold any Chill
Bros data**:

| Platform | Name | Why it's not it |
|---|---|---|
| Neon | `chill-pro-made` (`calm-mud-93982933`) | Different compute endpoint (`ep-plain-art-ax19j24f`). Schema is an unrelated app: `jobs`, `labor`, `change_orders`, `equipment_and_parts`, `estimate_versions`. No `chillbros_*` tables. |
| Neon | `Chill pro Q3D` (`restless-math-36137941`) | Different compute endpoint (`ep-green-math-arhmkeew`). `public` schema is completely empty. |
| Supabase | — | There is no Supabase project for Chill Bros at all. The only two Supabase projects on this account (`alpha-hunter`, `bbb-sports-intelligence`) belong to an unrelated app in a different org (`Boodavelli Org`). The Supabase → Neon migration left no live Supabase copy of Chill Bros data behind. |

If a future session (or a teammate) is unsure which project is real, re-run
the endpoint-id and business-name checks above rather than guessing from
project names — several of them are intentionally/accidentally similar.

## Data API gotcha: `db_max_rows`

Neon's Data API (the PostgREST-compatible REST layer the app queries through)
enforces its own server-side row cap, **independent of any `.limit()` set in
application code**. This is configured per branch/database via
`mcp__Neon__get_data_api` / `update_data_api` (or the Neon console → your
project → Data API settings) and is *not* the same thing as a Supabase
`db-max-rows`-style setting most people are used to seeing surfaced in an ORM.

On 2026-09-21 this was found silently capping `chillbros_revenue_prospects`
list responses at a hidden default (~80 rows) even after the app-level query
limit was raised from 100 to 1000 — new leads ranked below the cap simply
never reached the browser, no matter how the page's own Supabase-client query
was written. It was set explicitly:

```
db_max_rows = 5000
```

on project `calm-recipe-99461264`, branch `br-snowy-frost-ay6w5d8y`, database
`neondb`. If leads ever silently stop appearing again, check this setting
*before* re-auditing the Next.js query code — it lives entirely outside the
app's source and won't show up in a code review.
