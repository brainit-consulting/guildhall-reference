# 010 — Stage changes and last activity

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

Every stage change, from the board or the deal form, is logged on the deal ("Moved from Contacted to Proposal"), and
each deal shows when anything was last logged on it, its contact or its company ("Last activity: 3 days ago").

## Why

Issue #18 (spec B11). Going cold (B14) and its check-in task (B16) read last activity; the MCP `move_deal_stage`
tool will reuse the stage-change rule, so both live in plain functions on `db`.

## Approach

`deal.last_activity_at` (timestamp, null until something is logged), backfilled by the migration from activities
already logged. `addActivity` moves it forward on the deal, or on every deal of the contact or company the activity
is on. `moveDealStage` and `updateDeal` read the old stage in the same statement as the update and log a
`stage_change` activity when it differs. The deal page and the deals table show the day as "today", "yesterday" or
"N days ago", worked out in the reader's own time zone.

## Tasks

### Task 1: Data

- [x] **Step 1:** `lastActivityAt` on `deal`; `npm run db:generate`; backfill in the new migration.
- [x] **Step 2:** `addActivity` updates last activity; integration tests for deal, contact and company.
- [x] **Step 3:** `moveDealStage` and `updateDeal` log stage changes, with who; `stageChangeText` with a unit test;
  integration tests.

### Task 2: Pages

- [x] **Step 1:** `daysAgo` in `dates.ts` with a unit test; a `DaysAgo` client component.
- [x] **Step 2:** Last activity on the deal page and the deals table (and its phone-width list).
- [x] **Step 3:** The board and the form pass the signed-in person to the stage change.

### Task 3: Tests and checks

- [x] **Step 1:** e2e: moving on the board shows "Moved from New to Contacted" on the deal's timeline; a call on
  the deal's contact shows "Last activity: today" on the deal and in the table.
- [x] **Step 2:** typecheck, lint, test, test:e2e, build; tried in a browser.

## Acceptance

- [x] Moving a deal on the board shows "Moved from X to Y" on its timeline.
- [x] Logging a call on a deal's contact updates the deal's last activity.

## Risks / open questions

- A company's activity touches the deals whose company it is, not deals whose contact merely works there; the spec
  says "its contact or its company", meaning the deal's own links.
- Creating a deal is not a stage change and logs nothing; a deal with nothing logged shows "Nothing logged yet".
- The stage update and the activity insert are two statements (the Neon HTTP driver has no interactive
  transactions). If the deal is deleted in between, the activity is refused and nothing is left behind.
- Moving a deal does count as activity: the stage change is itself an activity on the deal.
