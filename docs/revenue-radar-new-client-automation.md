# Revenue Radar new-client automation

Status: approved implementation contract.

## Goal

Turn qualified Revenue Radar prospects into new Chill Pros customers with an auditable, automated outreach and approval flow without creating a second CRM.

## Customer-facing positioning

Every automated introduction and proposal must clearly state that Chill Pros provides full-service commercial repair and maintenance, including:

- HVAC and air conditioning
- Commercial refrigeration and walk-ins/reach-ins
- Ice machines
- Commercial kitchen and hot-side equipment
- Kitchen exhaust and vent hood service
- Preventive maintenance
- General commercial equipment diagnostics and repair

Copy must not imply a prospect has broken equipment unless the customer or a verified source established that fact.

## Automation lifecycle

1. Revenue Radar discovers or receives a new prospect.
2. Existing DNC and contact validation rules run before outreach.
3. A personalized introduction is prepared for a valid business contact.
4. Outreach is sent and logged as an activity.
5. If no response, create dated follow-up tasks rather than uncontrolled repeated email.
6. Interested prospects move to qualified/proposal_requested using the existing sales status model.
7. A secure proposal/approval link is issued with an expiring, single-purpose token.
8. Public approval page supports Approve, Request Changes, and Decline without requiring an existing customer login.
9. Approval records typed signer name, terms acceptance, proposal/version identifier, timestamp, and server-observed audit metadata. Optional signature may be stored if enabled.
10. Approved lead is converted idempotently into the canonical Chill Pros customer/location/contact records.
11. When service is requested, create exactly one canonical job and place it into the normal unassigned-work workflow.
12. If a deposit is required, approval does not schedule work until the payment requirement is satisfied.
13. Revenue Radar history records every material state transition and the originating lead remains preserved.

## Required states

The UI may display friendly labels, but implementation should map onto the existing sales model wherever possible:

- New
- Outreach Ready
- Sent / Contacted
- Interested / Qualified
- Proposal Requested
- Proposal Sent
- Viewed
- Changes Requested
- Approved / Won
- Deposit Required
- Declined / Lost
- Nurture
- Do Not Contact

Proposal-specific state belongs on the proposal/outreach record rather than overloading chillbros_revenue_prospects.sales_status with incompatible values.

## Safety and idempotency

- Never contact Do Not Contact records.
- Never invent customer needs, equipment failures, contact names, or email addresses.
- Prevent duplicate sends for the same automation step.
- Prevent duplicate approval conversions.
- Preserve the original prospect and approval evidence.
- Use existing customer/job tables and workflows. Do not create parallel customer or dispatch systems.
- All mutations require audit history.
- Customer-facing tokens must be unguessable, hashed at rest, scoped to one proposal, revocable, and expiring.
- Public approval endpoints must validate proposal version so an old link cannot approve a changed price or scope.
- Automated follow-up must stop on reply, approval, decline, unsubscribe/DNC, hard bounce, or manual stop.

## Implementation slices

1. Migration: outreach/proposal/approval records, token hash/version, delivery/view/decision timestamps, conversion IDs, uniqueness constraints.
2. Server services: compose outreach, queue/send, log delivery, schedule follow-up, stop automation.
3. Proposal service: create/version proposal and issue secure approval token.
4. Public approval route: view, approve, request changes, decline.
5. Conversion service: transactionally create/find customer + location + contact + optional job; idempotent by approval/conversion key.
6. Revenue Radar UI: automation status, send/resend, stop automation, proposal status, activity timeline.
7. Scheduled runner: process due follow-ups with DNC/reply/bounce checks.
8. Tests: authorization, DNC, duplicate prevention, token expiry/revocation/versioning, approval audit, customer conversion, job creation, deposit gating, follow-up stopping.
9. Production verification: lint, typecheck, tests, build, preview browser test, production deployment, production browser retest.

## Definition of done

This feature is not complete merely because code is committed. It is complete only after migrations are safely applied, required mail/payment environment configuration is present, tests/build pass, a preview flow succeeds end-to-end, production is deployed, and production is retested without sending unsolicited test mail to real prospects.
