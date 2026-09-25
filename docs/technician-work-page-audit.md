# Technician single Work Page — audit (2026-09-25)

Branch: `feat/technician-single-work-page`, cut from `main` at `1e17c76`
("Quote page per call, verbal approval, bought parts, Parts Pro, Open Work (#156)").
`main` has not moved since the prompt's audit, so section 2 of the task still
describes the code accurately, with the differences listed below.

Live database checked read-only (Supabase `xespxlqcjvhompsxranc`, per
`docs/database-source-of-truth.md`). No writes, no migrations applied.

## Differences from the task prompt (need your attention)

1. **The customer portal already shows job photos.** `app/portal/[token]/page.tsx:60`
   renders `MediaAccordion ... readOnly` with the job's before/after photos, so
   customers with the portal link see every original photo today. The prompt says
   "original photos must never be exposed to customers." Changing that alters a
   live customer-facing screen, so I have **not** touched it — tell me whether to
   (a) remove photos from the portal, (b) keep only after-photos, or (c) leave it.
   Receipts and on-site signatures are new and will never be read by portal/PDF/email code.
2. **Security model is server-side, not RLS-per-user.** Every `chillbros_*` table
   has RLS on with a single `server service role only` policy (or no policy and
   `revoke all from anon, authenticated`). The browser never talks to Supabase;
   server actions use the service role and enforce role/assignment checks in code.
   The new tables follow that same model. "Assigned tech + manager/office" is
   enforced in the new server actions, and tests cover it.
3. **Technicians can only set 3 statuses today.** `updateTechnicianJobV2Action`
   (`lib/chillbros/job-workflow-v2.ts`) allows only `en_route`, `arrived`,
   `work_complete`. The Work Page status dropdown and NEED PARTS / RETURN VISIT
   buttons need a small, explicit transition map (e.g. `arrived → diagnosing →
   parts_required | repairing → work_complete`). I'll widen it with a
   from→to map, still scoped to the assigned tech and still one status enum.
4. **Techs can't upload photos after arriving.** `uploadJobPhotoAction`
   (`lib/chillbros/mutations.ts:290`) limits technicians to `scheduled` /
   `in_progress`, so a tech at `arrived`/`diagnosing`/`repairing` gets
   "This call is unavailable for photo uploads." I'll align it with
   `FIELD_PART_STATUSES` from `job-parts.ts`.
5. **Reschedule leaves no history.** `rescheduleJobAction` only logs the
   assignment email result, not who moved the call, old → new time, or why.
   The tech wrapper will write a `rescheduled` workflow event (and manager/office
   reschedules will get it too, as a pure addition).
6. **Return visit scheduling is office-only.** `scheduleReturnVisitAction`
   rejects technicians and requires an approved invoice. For the tech's
   RETURN VISIT button I plan to reuse the tech reschedule sheet (same job, reason
   "Waiting on parts") rather than open up that action. Office keeps the existing
   form.
7. **No diagnostic-readings table.** Readings are stored as JSON in
   `chillbros_workflow_events` (`stage = 'diagnostic_readings'`,
   `lib/chillbros/diagnostic-readings.ts`), which already records tech identity
   and timestamp. The Work Page will reuse that.
8. **Repair/return notes need no schema.** `work_performed` holds running notes;
   repair outcome (completed / returning with parts / temporary repair) + final
   notes will be a `repair_report` workflow event using the same JSON pattern as
   diagnostic readings; final readings reuse `saveDiagnosticReadingAction`.
   So section 3 item 4 adds **no columns**.
9. **Naming collision to be aware of:** `chillbros_receipts` already exists — it's
   the *customer payment* receipts table. The new internal table is
   `chillbros_job_receipts`, as specified; the two are unrelated.
10. **Tech queue vs. job page ownership.** `getAssignedFieldJobsForTechnician`
    also matches jobs assigned to other profile rows with the same email/name
    (legacy duplicate profiles), while `/jobs/[id]` strictly requires
    `assigned_tech_id === profile.id`. A tech could see a job in their list and be
    bounced from it. I'll keep the strict check (it's the safe one) and make the
    new landing lists use the same strict id so they agree.
12. **"Need to order" parts can't be added by a tech today.** `chillbros_add_job_part`
    rejects tracked parts with insufficient stock, and "Bought part" (custom part)
    is manager-only (`canAddCustom={profile.role === "manager"}`), and it also
    *adds stock* to the catalog. So a tech has no way to record a part they don't
    have. Options: (a) let the assigned tech use "Bought part" for
    `need_to_order` rows, (b) skip the stock check when the new row is
    `need_to_order` (needs an RPC change — a migration I'd show you first), or
    (c) techs pick status only on parts already added. I recommend (a) for now.
11. **Tests:** there's no `npm test` script. Existing tests are
    `node --test scripts/*.test.cjs` with an in-memory Data API double
    (`scripts/core-workflow.test.cjs`). New tests will follow that harness.

## Proposed migrations (NOT applied — awaiting approval)

| File | What |
|---|---|
| `supabase/migrations/20260925120000_chillbros_job_parts_field_status.sql` | nullable `field_status` (check: `on_truck`/`need_to_order`/`ordered`, default for new rows only) + nullable `notes` on `chillbros_job_parts` |
| `supabase/migrations/20260925120100_chillbros_job_receipts.sql` | new `chillbros_job_receipts`, RLS on, service-role only, `receipts/` path check |
| `supabase/migrations/20260925120200_chillbros_job_signatures.sql` | new `chillbros_job_signatures`, RLS on, service-role only, `signatures/` path check |

Each file has a commented ROLLBACK section. Job FKs use `on delete restrict` so a
hard job delete can't silently wipe receipts/signatures.

## Proposed reschedule → status mapping (awaiting approval)

Same job row, `scheduled_window` changes, notes/photos/parts untouched.

| Current status | After tech reschedule |
|---|---|
| `new`, `needs_scheduling`, `scheduled`, `dispatched`, `en_route` | `scheduled` |
| `arrived`, `in_progress`, `diagnosing` | `scheduled` — or `parts_required` if reason is "Waiting on parts" |
| `awaiting_approval`, `approved` | unchanged |
| `parts_required`, `return_visit_needed` | unchanged |
| `repairing` | `return_visit_needed` (or `parts_required` if reason is "Waiting on parts") |
| `work_complete`, `ready_to_invoice`, `invoice_sent` | blocked for techs (work is done; office handles) |
| `paid`, `completed`, `cancelled` | blocked (as today) |

Tech restrictions: must be `assigned_tech_id` on the job; `assignedTechId` from
the form is ignored for techs (can't reassign); conflict check via the existing
`technicianConflict`. Manager/office path is unchanged apart from the added
history event.

## Files I expect to touch

New
- `components/work-page/*` — sticky header, action bar, reschedule sheet, receipts, signature pad, part-status row, repair report
- `lib/chillbros/job-receipts.ts`, `lib/chillbros/job-signatures.ts`, `lib/chillbros/repair-report.ts` (server actions + queries)
- `app/technician/history/page.tsx` — tech-scoped completed jobs
- `scripts/technician-work-page.test.cjs`
- the three migrations above

Changed
- `app/jobs/[id]/page.tsx` — becomes the single Work Page (office/manager sections kept)
- `app/technician/page.tsx` — compact collapsible landing; estimate/portal UI moved out
- `app/schedule/actions.ts` — role check widened for the assigned tech via shared helper + `rescheduled` event
- `lib/chillbros/job-workflow-v2.ts` — technician status transition map
- `lib/chillbros/job-parts.ts`, `components/job-parts-card.tsx` — part status/notes
- `lib/chillbros/queries.ts` — `getJob` returns part status/notes + equipment
- `lib/chillbros/mutations.ts` — photo upload status list for techs
- `lib/chillbros/nav.ts` — technician tabs Home | My Work | History | Account
- `components/job-screen-actions.tsx` — `TechNotes` draft-safe autosave

Not touched: owner/manager/office nav and screens, `/schedule`, dispatch,
invoices, portal, PDF, email, env vars (none added).
