# Chill Pros HQ — how it's built (and the backup)

HQ (https://chill-pros-hq.vercel.app) is the team workspace: Brae, Eric, Mack, Henry, Nick and Mob sign in with a name + PIN.
It is **not** a normal repo app. This folder is the source-of-truth snapshot so it can be rebuilt or rolled back.

## Pieces

| Piece | Where it lives |
| --- | --- |
| The whole HQ page (one ~227 KB HTML file, all screens) | Supabase project `rbhtdgqpktocavxbiafw`, table `hq_assets`. The live version is whatever `hq_asset_live` points `index` at (2026-10-26: `index_v24`). Snapshot: `backup/index_v24.html` |
| Database functions (sign-in, boards, permissions, messages, files) | Same Supabase project. Snapshot: `backup/functions.sql` |
| Vercel project `chill-pros-hq` | Serverless functions `api/page.js` (serves the page from `hq_asset`), `api/ai.js` (HQ's "Ask" assistant), `api/digest.js` (AI reads project files into a plan), icons, per-person manifests, `vercel.json` (`backup/vercel.json`, `backup/api-page.js`) |
| Project routing rules on `chill-pros-hq` | `/command-center/*`, `/cc-money`, `/cc-talk`, `/manifest-brae.json` forward to this repo's app (chill-bros.vercel.app); `/api/ai` forwards to this repo's `/api/hq/ai` (Claude) |

## Data model

`hq_items(id, board, kind, data jsonb, updated_at, updated_by, deleted)`.
Boards: `brae`, `eric`, `mack`, `henry`, `nick`, `mob` (personal), `team` (Brae + Eric), `truck` (Brae + Mack, food truck), `venture` (Brae + Henry + Nick + Mob, GIBAM).
Kinds: goal, plan, step, task, project, event, role, file, income, invoice, owed, idea, note, vision, venture, budget, check, menu, recipe, info.
Read with `hq_pull(token)`, write with `hq_put(token, id, board, kind, data)` / `hq_del(token, id)`, messages with `hq_send_to`, files with `hq_file_put` / `hq_file_get`. Permissions are in `hq_can` / `hq_full` / `hq_member_ok`.

## Rolling back the page

`update hq_asset_live set target = 'index_v23' where name = 'index';` (older versions stay in `hq_assets`).
Rolling back the AI to Gemini/OpenAI: delete the `/api/ai` routing rule on the `chill-pros-hq` project.
