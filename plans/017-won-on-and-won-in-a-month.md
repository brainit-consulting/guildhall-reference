# 017 — When a deal was won, and the deals won in a month

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

Every deal at Won knows the business's calendar day it got there (`won_on`), and `/deals?won=2026-10` lists the
deals won that month with their count and value.

## Why

Issue #33, part of B14 (the dashboard). Home's "Won this month" needs a fact that `updated_at` can't give: it changes
on any edit, and a deal added straight at Won has no stage-change activity. The Home number itself is a later issue.

## Approach

A nullable `won_on date` on `deal`, set in `createDeal` and `setDeal` (the one place every stage change passes), so
the form, the board and later MCP tools all get it. Won to Won keeps the day (`coalesce(won_on, today)`); any other
stage clears it. The migration fills it for deals already at Won from their latest move into Won, else `updated_at`,
converted to the business's time zone in SQL (measured: PGlite has the zone data). `dates.ts` gains `monthIn`,
`isMonth`, `formatMonth`; `deals.ts` gains `wonInMonth` and a `won` filter in `readDealView`/`dealWhere`, with
`wonDealsTotal(db, view)` for the figures row.

## Tasks

### Task 1: Data

- [x] **Step 1:** Schema column, `npm run db:generate`, backfill in the new migration.
- [x] **Step 2:** `monthIn`, `isMonth`, `formatMonth` with unit tests.
- [x] **Step 3:** won_on in `createDeal` and `setDeal`; `wonInMonth`; `won` in the view and where-clause; tests.

### Task 2: Pages

- [x] **Step 1:** Deals list: "Won in October 2026" line with a remove link, Won deals / Won value figures, clear filters clears `won`.
- [x] **Step 2:** Deal page: "Won 3 Oct 2026" beside the stage.

### Task 3: Tests and checks

- [x] **Step 1:** `e2e/deals-won.spec.ts`: move a deal to Won, find it at `/deals?won=<this month>`, delete it.
- [x] **Step 2:** typecheck, lint, test, test:e2e, build; tried in a browser.

## Acceptance

- [x] Adding at Won, moving to Won on the board, and changing to Won in the form set today's day; moving out clears it; editing a Won deal keeps it.
- [x] `/deals?won=<this month>` lists exactly those deals with matching Won deals and Won value; `won=junk` and `won=2026-13` show the normal list.

## Risks / open questions

- The backfill names the zone (`America/New_York`) in SQL, a copy of `TIME_ZONE`; a migration is a record of the day it ran, so that's acceptable.
- Stored timestamps are read as UTC, as Drizzle reads them. PGlite's session zone is a fixed offset (measured `Etc/GMT+5` on a New York machine), so `now()` defaults there aren't strictly UTC; out of scope here.
- Measured while testing: after midnight in New York, four existing e2e tests (activities, pipeline timeline) fail on
  main as well as here, because of that offset ("yesterday" for a move just made). Not changed by this plan.
