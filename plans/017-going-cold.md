# 017 — Going cold

**Status:** in-progress
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

One going-cold rule (`COLD_DAYS`, `isCold`, `quietDays`) with a matching database filter (`coldDeals`, `cold=1`),
and the Deals list marks going-cold deals in words and has a "Going cold" switch.

## Why

Issue #34 (Beginner 14, the dashboard). Home counts and lists these deals later; B16's check-in reuses the rule.

## Approach

`src/lib/cold.ts` holds the rule with no database imports; `src/lib/dates.ts` gains `addDays`, `daysBetween` and
`dayStartIn` (the instant a day starts in a zone). The database qualifies a deal when it is open and
coalesce(last_activity_at, created_at) is before the start of the business's day `today - 13`, the same line as
`quietDays >= 14`. `dealWhere` takes `now` so the table, the open figures and `coldDeals` share it.

Measured on PGlite: the session time zone follows the host's standard offset (Etc/GMT+5 here), so `now()` defaults
were stored 5 hours off the UTC that Drizzle writes and reads. PGlite is now started with `timezone = 'UTC'`, as Neon
already is, so every `timestamp` column holds UTC.

## Tasks

### Task 1: Rule and dates

- [ ] **Step 1:** `addDays`, `daysBetween`, `dayStartIn` in dates.ts, with unit tests across both clock changes.
- [ ] **Step 2:** `cold.ts`: `COLD_DAYS`, `quietDays`, `isCold`, `coldSince`; unit tests (14, 13, never logged, Won,
  Lost, 1 Nov).

### Task 2: Database

- [ ] **Step 1:** PGlite in UTC (client, test db, migrate script).
- [ ] **Step 2:** `readDealView` reads `cold=1`; `dealWhere(view, now)`; `coldDeals(db, now)`.
- [ ] **Step 3:** Integration tests: query agrees with `isCold` either side of the line; activity on deal, contact or
  company removes it; the filter and open figures.

### Task 3: Page

- [ ] **Step 1:** "Going cold" switch beside "Open only"; filters and Clear link know it.
- [ ] **Step 2:** "Going cold" beside last activity in the table and phone rows.
- [ ] **Step 3:** Playwright: a new deal is not marked and not at `cold=1`; the switch sets `cold=1`; reload keeps it.

### Task 4: Checks

- [ ] **Step 1:** typecheck, lint, test, test:e2e, build; a backdated deal seen in the browser.

## Acceptance

- [ ] A deal with nothing logged for 15 days is marked and listed at /deals?cold=1; a call on it, its contact or its
  company takes it off.
- [ ] Open figures follow the filter.

## Risks / open questions

- Existing local `.data` rows written before the UTC change keep their old offset; dev data only.
