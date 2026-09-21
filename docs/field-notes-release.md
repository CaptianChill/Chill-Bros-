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

Confirm the Vercel project is `chill-pros/chill-bros-` and that its operational data
API points at the database containing the Field Notes migration. Existing env names
are `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; these names
alone do not establish whether the underlying database is Supabase or Neon.

1. Verify `neon/migrations/202609200001_field_notes_ai.sql` is applied to that database.
2. Inspect the API service role and its RLS behavior, then apply
   `supabase/migrations/20260921004246_field_notes_server_access.sql`. All access is
   through authenticated server actions and routes. The server role must have
   privileged access; browser roles must not have direct access to these tables.
3. Verify a private, Supabase-compatible `chillbros-media` bucket exists at the
   configured storage endpoint. Neon Data API table compatibility alone does not
   establish Storage API compatibility. Do not point uploads at a public bucket.
4. Confirm Vercel AI Gateway authentication/funding for `openai/gpt-5.6-terra`.
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
