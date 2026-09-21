# Field Notes release and verification

Eric uses Android. His entry point is `/field-notes`. It uses the existing staff login and returns
to Field Notes after signing in. Add that page to the phone's Home Screen after
login; its dedicated manifest launches Field Notes in standalone mode. A network
connection is required to open the app and send. An open page retains an unfinished
draft in IndexedDB when the browser permits it; sending is explicitly retried by
the technician after reconnecting. It does not promise offline application launch.

For Eric's Android phone, open the final production link in Chrome, sign in, then
use Chrome's menu to install/add Field Notes to the Home Screen. The manifest
includes 192px and 512px PNG launcher icons. Confirm the installed icon reopens
the Field Notes screen on his device. Installation wording varies by Chrome version.

## Backend prerequisites

Confirmed preview runtime requests use Supabase project `xespxlqcjvhompsxranc`
(dashboard display name `bbb-sports-intelligence`) for the operational Chill Pros
tables. Neon provides sign-in. The original migration was installed in Neon and
was absent from this operational database, causing the Field Notes load failure.
The operational schema and server-only permissions were applied and verified on
September 21, 2026 UTC using `20260921012119_field_notes_operational_schema.sql`.
Existing env names
are `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; these names
alone do not establish whether the underlying database is Supabase or Neon.

1. For another operational environment, apply
   `supabase/migrations/20260921012119_field_notes_operational_schema.sql` after
   verifying the target and existing Chill Pros tables. It includes the schema
   and permissions. The earlier hardening migration safely skips absent tables.
2. Verified on the current destination: all three tables have RLS enabled,
   `service_role` has CRUD access and bypasses RLS, and `anon`/`authenticated`
   have no direct table access. A service-role transaction inserted a submission,
   image reference, and audit entry, updated the text, and read the staff join;
   the transaction was rolled back after verification.
3. A private `chillbros-media` bucket was confirmed at the
   configured storage endpoint. Actual upload/download remains part of live acceptance.
   Neon Data API table compatibility alone does not
   establish Storage API compatibility. Do not point uploads at a public bucket.
4. Field Notes uses the existing production `OPENAI_API_KEY` directly through
   OpenAI Responses, defaulting to `gpt-5.4`. `OPENAI_FIELD_NOTES_MODEL` can
   override the model. Responses are requested with `store: false`. Missing
   credentials leave the submission available for manual review or retry.
   The previous Gateway model was blocked by the team's free tier.
5. Production recovery uses the existing `CRON_SECRET` and a five-minute cron
   (Pro plan). Preview uses `after()` and the manager's Retry control; Vercel cron
   scheduling only operates in production.

## Data lifecycle

The phone prepares JPEG pages at a maximum of 3 MiB each (10 pages per submission)
and uploads them individually. The server verifies the reserved file hash and
ownership. A stable draft UUID makes retries resume the same submission. The app
does not clear the phone draft until the server confirms delivery. Browser storage
failure is explicitly shown. Browser camera capture is not guaranteed to save to
the camera roll: take photos using the phone Camera app, then choose Upload photos
when retaining local originals is required.

AI runs after delivery and can be recovered if a worker stops. The owner checks
uncertain values against the photos, saves edits, links the customer/job/equipment,
and explicitly approves the current saved revision. Complete saves completion
first, then deletes temporary photos. Cleanup failure retains image references for
retry. Approved text and audit history remain in Field Notes. Nothing is silently
appended to a customer-visible invoice; use the Customer Version copy action for
customer-facing text and Copy Notes for internal records.

## Required live acceptance

- Sign in as Eric and confirm the assigned jobs shown match his real assignments.
- Upload a real handwritten page, multiple pages, and a large phone photo.
- Interrupt a send, reconnect, retry, and confirm only one submission exists.
- Refresh after failure and confirm the local draft is recovered.
- Verify AI extraction and legibility of page previews; check model/serial/part
  numbers, refrigerant quantities, and labor values against the originals.
- Owner: link, edit, save, approve, complete; reload and confirm text persists and
  photos are removed. Test cleanup retry without losing the saved text.
- Confirm signed-out/other-technician requests cannot read images or mutate notes.
- Add to Home Screen and relaunch on Eric's actual phone.
- Verify production deployment revision and repeat the short submit/review flow.

## Automated validation

`node --test scripts/field-notes.test.cjs` exercises actual transpiled server
modules with service doubles: idempotent uploads, incomplete delivery, authorization,
file validation, job relationships, failed writes, AI failure, stale work recovery,
concurrent review protection, approval, and cleanup recovery. These tests do not
substitute for the real backend, model, or phone checks above.

## Typed notes and invoice wording (September 21 first slice)

The intake accepts typed notes, photos, or both. Equipment can be selected from
existing customer equipment, or identified in the typed notes when not on file.
The AI produces a separate invoice description; the owner can edit it before
approval and copy it once approved. No invoice is changed or sent automatically.

Apply `20260921204213_field_notes_invoice_description.sql` to the verified
operational database before deploying this revision. The additive text column
was applied to `xespxlqcjvhompsxranc` and verified in its SQL Editor.

The local production build uses a temporary, process-only cookie signing value
for build validation because deployment secrets are not stored in this checkout.
This does not verify live authentication or OpenAI access. The remote preview
builds using the project's existing environment. The OpenAI key is scoped only
to production; live AI acceptance is performed there without copying the key
into preview or this checkout.
