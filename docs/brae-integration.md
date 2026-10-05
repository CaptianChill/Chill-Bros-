# Brae.I. ↔ Chill Pros CRM (read-only, v1)

Lets the owner's local assistant (Brae.I. — Open WebUI on the MSI laptop) answer
questions from live CRM data. **Read-only**: nothing here creates, edits, sends
or deletes anything.

## Endpoints

All require `Authorization: Bearer <BRAE_API_KEY>`. If `BRAE_API_KEY` is unset
(or shorter than 32 characters) every call returns 503 — the integration is off.

| Route | What it returns |
|---|---|
| `GET /api/brae/today?date=YYYY-MM-DD&days=1..7` | Scheduled jobs (Central time), defaults to today |
| `GET /api/brae/unassigned` | Open jobs with no technician (Unassigned Work) |
| `GET /api/brae/customers?q=...` | Customer search by name/phone/email + 5 most recent jobs |
| `GET /api/brae/unpaid-invoices` | Outstanding invoices (same rules as Invoice Center) + money summary |

`/api/brae` is in `PUBLIC_PATH_PREFIXES` in `proxy.ts` so Neon session
middleware doesn't redirect it; each route enforces the bearer key itself
(`lib/brae/auth.ts`, constant-time compare). Data comes from the live Supabase
project via the existing service-role queries — see
`docs/database-source-of-truth.md`.

## Setup

1. Vercel → project → Settings → Environment Variables → add `BRAE_API_KEY`
   (Production), a random value of 40+ characters. Redeploy.
2. Open WebUI → Workspace → Tools → **+** → paste
   `tools/brae/chill_pros_crm_tool.py` → Save.
3. Click the tool's gear (Valves): `api_base_url` =
   `https://chill-bros.vercel.app`, `api_key` = the same `BRAE_API_KEY`.
4. Workspace → Models → edit the model you chat with → enable
   **Chill Pros CRM** under Tools. Use a model that handles tools well
   (e.g. `qwen2.5-coder:7b`; 3B models pick tools unreliably).
5. Ask: "What's on the schedule today?" / "Who owes us money?"

To shut it off instantly: delete `BRAE_API_KEY` in Vercel and redeploy.

## Next (not built yet)

Write actions (draft quote, add field note, outreach draft) — each must land as
a draft/pending item that owner/office approves in the CRM, never sent to a
customer automatically.
