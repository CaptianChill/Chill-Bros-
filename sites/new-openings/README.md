# San Antonio New Openings — standalone site

Public sales page (`/`) and owner dashboard (`/owner`) for the lead business.
Deployed as its own Vercel project (root directory `sites/new-openings`), separate from the Chill Pros app.

## Rebrand / move to a new domain
1. Edit **`lib/brand.ts`** — name, quote, phone, email, prices, payment links. Nothing else holds brand text.
2. In Vercel → this project → Settings → Domains, add the new domain.
3. To move to its own repo: copy this folder as-is; it has its own package.json and no imports from the Chill Pros app.

## Settings (Vercel environment variables)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — public database address and public key.
- `LEADBIZ_DB_KEY` — secret that unlocks the owner dashboard function (its SHA-256 is in table `chillbros_leadbiz_settings`).
- `OWNER_PASSWORD` — password for `/owner`.

The site never holds a database admin key: it can only call `leadbiz_public_stats()` (counts) and
`leadbiz_owner_dashboard(key)` (owner data, key-checked). Migration: `supabase/migrations/20261105200000_leadbiz_site_rpc.sql`.

Still inside the Chill Pros app for now: the contractor outreach cron, lead-pack downloads (`/lp`) and the lead finder.
