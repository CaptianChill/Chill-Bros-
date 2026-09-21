@AGENTS.md

# Chill Pros ("Chill Bros" repo) — read this before touching data

**There are two database projects for this app, and only one is live.**
Before running any query, migration, or fix that touches app data
(customers, jobs, invoices, parts, revenue prospects, anything), read
`docs/database-source-of-truth.md` in full. It is not optional background —
a full day of real fixes was applied to the wrong database on 2026-09-21
before this was caught, while the live app kept failing for the owner.

Short version: the real, live database is the **Supabase** project
`bbb-sports-intelligence` (id `xespxlqcjvhompsxranc`) — its name looks
unrelated on purpose; trust the doc, not the name. A separate Neon project
(`Chill Bros`, `calm-recipe-99461264`) exists from an abandoned migration
attempt and is *not* what production reads from for core data, even though
matching seed data in both will make a casual check look reassuring. The
doc explains exactly how this was proven and how to re-verify it yourself
without being fooled by that overlap.

This warning stays here until the migration to Neon (if it happens) is
actually finished and confirmed — not assumed.

## Also read before touching billing/domain code

- `docs/2026-09-21-session-log.md` — full record of what was fixed on
  2026-09-21 (Revenue Radar, inventory tracking, job-status enum, employee
  login FK, customer-facing branding) and, importantly, a **temporary env
  var override** (`NEXT_PUBLIC_APP_URL=https://chill-bros.vercel.app`) that
  is intentionally live right now because `chillprostx.com`'s DNS isn't
  pointed at Vercel yet. Don't "clean that up" without reading why it's
  there first — removing it breaks every customer-facing link.
