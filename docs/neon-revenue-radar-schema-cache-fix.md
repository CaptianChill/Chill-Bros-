# Revenue Radar Neon Data API schema-cache incident

## Symptom
Production `/revenue-radar` showed: "Revenue Radar storage is not ready. Could not
find the table 'public.chillbros_revenue_prospects' in the schema cache." Pressing
"Scan for leads" could surface the global error boundary.

## Audit performed
- Confirmed `public.chillbros_revenue_prospects` exists on the correct Neon project
  (Chill Bros, `calm-recipe-99461264`) and branch (`main`, `br-snowy-frost-ay6w5d8y`,
  database `neondb`), with the same grants (`authenticated`, `neondb_owner`) as
  `chillbros_jobs`, a table the app queries successfully.
- Compared the two other Neon dev branches on the same project
  (`stabilize-identity-schedule-20260915`, `dev-neon-staff-auth-drafts-20260915`):
  both branches carry every other `chillbros_*` table but were forked before
  `chillbros_revenue_prospects` existed, so they lack it entirely. Both branches
  show zero compute activity since 2026-09-15, while `main`'s compute has been
  continuously active through the production error window (2026-09-19), which
  rules out production pointing at either dev branch's Data API.
- Reviewed `lib/supabase/config.ts`, `service-client.ts`, `auth-server.ts`,
  `lib/auth/server.ts`, `app/revenue-radar/page.tsx`, `app/revenue-radar/actions.ts`,
  and `app/api/cron/revenue-radar/route.ts`. All correctly target `SUPABASE_URL` /
  `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` for the Neon Data API; no code
  or Vercel environment-variable change was needed.
- Cross-checked Vercel production runtime error logs: the only "table not found"
  errors in the last 7 days were for `chillbros_revenue_prospects` specifically,
  never for any other `chillbros_*` table — consistent with the correct Data API
  target simply not having refreshed its PostgREST-style schema cache after the
  table was created, not a misconfigured target.

## Root cause
Neon's Data API (PostgREST-compatible) had not reloaded its schema cache after
`chillbros_revenue_prospects` was created on `main`, so it returned PGRST205
("not found in schema cache") even though the table, grants, and data all exist
correctly on the branch production already targets.

## Fix
1. Sent `NOTIFY pgrst, 'reload schema';` against `neondb` on branch
   `br-snowy-frost-ay6w5d8y` to force an immediate PostgREST schema cache reload.
2. Re-applied the branch's Data API configuration via Neon's `update_data_api`
   (identical settings) as a second, redundant reload path.
3. Triggered a fresh production deployment
   (`dpl_BJMPw3AY1nSq6iPQweoVi4egb6hf`, commit `7ad4abfd3ff73ce125f53f616a44d574e156941e`)
   so all serverless function instances start with clean connections.

No Vercel environment variables and no application code required changes.

## Verification
- `select id, business_name, score, status from public.chillbros_revenue_prospects
  limit 1;` runs cleanly against `main` (0 rows — table is empty but reachable).
- `chillbros_revenue_prospects` has row-level security disabled, matching the
  server-only access pattern already used by `chillbros_jobs`, so the existing
  `authenticated`-role grants are sufficient for both `SELECT` (list page) and
  `INSERT`/`UPDATE` (scan + edit actions) once the schema cache is warm.
- Production deployment `dpl_BJMPw3AY1nSq6iPQweoVi4egb6hf` is READY and aliased to
  `chill-bros.vercel.app`.
- This session's sandbox network policy blocks outbound HTTP to
  `chill-bros.vercel.app` and to the Neon Data API host directly, so the live
  `/revenue-radar` page and the "Scan for leads" action could not be
  browser-tested from here. A manual click-through (or a `GET
  /api/cron/revenue-radar` check) is the remaining confirmation step.
