# Chill Bros Operational Command Center

Production Next.js app for Chill Bros dispatch, manager controls, technician workflows, customers, equipment, estimates, inventory, timesheets, agreements, reporting, security, and training.

## Backend source of truth

Chill Bros uses one backend: the dedicated Chill Bros Neon project. Neon
Lakebase Postgres stores operational data, Neon Data API serves application
queries, and Neon Auth owns staff identities and sessions. Supabase is not a
Chill Bros database and must not be configured as one.

The `@supabase/supabase-js` package remains temporarily as a PostgREST client
for the Neon Data API. Package compatibility does not make Supabase a backend.
See `docs/BACKEND_SOURCE_OF_TRUTH.md` for the enforced boundary and cutover
rules.

## Local verification

```bash
npm ci
npm run lint
npm run build
```

## Active branding assets

- `public/logo.png` — primary app/PWA logo
- `public/chill-bros-loader.webp` — loading screen artwork
- `public/internal/chill-bros-smiley-v4.png` — internal header smiley
- `public/internal/chill-bros-texas-v3.png` — internal header Texas mark

The loading screen uses exactly one canonical image path. No fallback logo or staging asset should be used for the loader.

## Production

Vercel deploys `main` from `CaptianChill/Chill-Bros-`. The GitHub Security audit runs dependency audit, lint, and a production build before a cleanup or code change is considered healthy.
