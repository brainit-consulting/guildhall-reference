# 026 — A check-in task for cold deals

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

When Home loads, every deal going cold has one open "Check in with Ann Lee about Kitchen refit" task, due today; one
per cold spell, and never two open at once.

## Why

Issue #53, the second half of B16. The owner wants one reminder per cold spell, not one a day, and logging anything
on the deal starts it over. #51 gave `task.automation`, `task.cold_since` and the unique index on (deal, cold spell).

## Approach

`checkInColdDeals(db, now)` in `src/lib/cold-check-in.ts`: read `coldDeals(db, now)` for the names, then one
`insert ... select` that joins those deals back to `deal` and keeps those still cold with no open check-in, taking
`cold_since` from the row itself (exact, microseconds and all) and doing nothing on conflict. A ticked check-in for
the same spell conflicts with the unique index, so it needs no query of its own. Two queries however many deals. Home
calls it before reading its figures.

## Tasks

### Task 1: The rule

- [x] **Step 1:** export `coldWhere` from `deals.ts` so the insert re-checks the same line.
- [x] **Step 2:** `cold-check-in.ts` with `checkInColdDeals`.
- [x] **Step 3:** `cold-check-in.integration.test.ts`: one at a time; twice; ticked; starting over after an activity;
  an open check-in from an earlier spell; Promise.all; the three names; the due day near New York midnight; Won, Lost
  and recently touched deals.

### Task 2: Home

- [x] **Step 1:** Home awaits `checkInColdDeals(db, now)` before its `Promise.all`.

## Acceptance

- [x] A deal quiet 15 days gets one check-in due today, shown in Home's Due today and on the deal; reloading or
  ticking it adds none.
- [x] After ticking it and logging a call, the deal isn't cold; 14+ days after the call it gets a new one.
- [x] typecheck, lint, test, test:e2e and build pass; tried in a browser with a backdated deal in `.data`.

## Risks / open questions

- Read-then-insert: a deal touched between the two queries is re-checked by the insert, so it gets nothing.
