# Chill Bros Backend Source of Truth

Status: permanent architecture decision

## Decision

Chill Bros has one live backend: the dedicated **Chill Bros Neon project**.

- Database: Neon Lakebase Postgres, database `neondb`
- Production branch: Neon `main`
- Authentication: Neon Auth
- Application data access: Neon Data API
- Schema changes: versioned migrations in `neon/migrations`

Supabase is not a second Chill Bros backend, replication target, fallback, or
write destination. The historical Chill Bros tables in the BBB Sports
Supabase project are a migration-era safety copy only. BBB Sports may continue
using Supabase independently.

## Why `@supabase/supabase-js` still appears

Neon Data API is PostgREST-compatible. The current application uses
`@supabase/supabase-js` as a transport client for that API. This is an SDK
implementation detail; every Chill Bros query must resolve to a `neon.tech`
host. The runtime guard in `lib/neon/data-api/config.ts` rejects any Supabase
URL.

## Canonical production variables

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `NEON_DATA_API_URL`
- `NEON_DATA_API_ANON_KEY`
- `NEON_DATA_API_SERVICE_ROLE_KEY`
- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET`
- `CRON_SECRET`

The legacy `SUPABASE_*` names are temporary deployment aliases for the same
Neon Data API values. They must be removed after the canonical `NEON_DATA_API_*`
variables are installed and a production verification passes.

## Rules

1. Never dual-write Chill Bros data to Neon and Supabase.
2. Never configure a `supabase.co` URL in the Chill Bros application.
3. Production deploys use the Neon `main` branch; preview deploys use isolated
   Neon preview branches.
4. Apply migrations with a direct/unpooled connection and run application
   traffic through the normal production connection or Data API.
5. Before removing a migration-era safety copy, verify table counts, critical
   workflows, staff sign-in, Revenue Radar, and scheduled jobs against Neon.
