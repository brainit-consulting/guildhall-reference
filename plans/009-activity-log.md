# 009 — The activity log

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

Every contact, company and deal page has "Log activity" (note, call or meeting, and the text) and a timeline of what
was logged on it, newest first, each with who and when ("Margery Kempe, 12 Oct 2026").

## Why

Issue #17 (spec B11). Stage changes, last activity and the going-cold automation (#18, B14, B16) and the MCP
`log_activity` tool all write or read activities, so logging and listing live in plain functions on `db`.

## Approach

One `activity` table: a kind (Postgres enum: note, call, meeting, stage_change), the text, who logged it (the user,
set null if they are ever removed), when (`created_at`), and exactly one of contact, company or deal (a check
constraint), deleted with the record it belongs to. `src/lib/activities.ts` holds `checkActivity`, `addActivity`
(any kind, already checked; for #18's stage changes), `logActivity` (what the form sends) and `listActivities`.
A shared `Activities` section (form + timeline) goes on the three pages.

## Tasks

### Task 1: Data

- [x] **Step 1:** `src/lib/activity-kinds.ts` (no imports, so the form can bundle it); `activity_kind` enum and
  `activity` in `schema.ts`; `npm run db:generate`.
- [x] **Step 2:** `src/lib/activities.ts`; `activities.test.ts` (checkActivity) and
  `activities.integration.test.ts` (logging, listing newest first with who, deleted records).

### Task 2: Pages

- [x] **Step 1:** `src/app/(signed-in)/_activities/`: the server action, the Log activity form, the timeline with the
  day shown in the reader's own time zone.
- [x] **Step 2:** The section on the contact, company and deal pages.

### Task 3: Tests and checks

- [x] **Step 1:** `e2e/activities.spec.ts`: a call on a contact, a note on a deal, empty text explained.
- [x] **Step 2:** typecheck, lint, test, test:e2e, build; tried in a browser.

## Acceptance

- [x] I can log a call on a contact and see it on that contact's timeline.
- [x] A note logged on a deal shows on the deal's timeline with who and when.

## Risks / open questions

- Deleting a contact, company or deal deletes its activities (they were about it; the delete already says it can't
  be undone). An activity is never moved to another record.
- The timeline shows the day only, as the issue's example does. The server has no idea of the reader's time zone,
  so the day is worked out in the browser; the server's first render uses UTC.
- Stage-change activities and last activity are #18 (plan 010).
