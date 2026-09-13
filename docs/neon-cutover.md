# Chill Bros Neon Cutover

Status: in progress

## Goal
Remove all runtime dependency on Supabase and run Chill Bros on Neon Postgres, Neon Data API, and Managed Better Auth.

## Destination
- Neon project: Chill Bros
- Database: neondb
- Managed Better Auth: enabled
- Neon Data API: enabled
- Production origin: https://chill-bros.vercel.app

## Cutover gates
1. Export the existing Chill Bros Supabase Postgres schema and data.
2. Restore and validate all `chillbros_*` tables, functions, constraints, and production rows in Neon.
3. Replace Supabase Auth with Neon Managed Better Auth.
4. Replace Supabase database client calls with Neon Data API / direct Neon Postgres access.
5. Recreate password-based staff accounts in Neon. Existing Supabase password hashes are not portable.
6. Set Neon production environment variables in Vercel.
7. Verify manager, office, and technician sign-in plus customer/job/estimate/invoice/payment workflows.
8. Remove Supabase packages and environment variables only after production verification.

## Safety rule
Do not delete or disable the Supabase source until row counts and critical workflow checks pass against Neon.
