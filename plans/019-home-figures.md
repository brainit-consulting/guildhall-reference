# 019 — The numbers on Home

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

A ledger of figures at the top of Home (open deals, won this month, each stage, overdue, due today, going cold), each
linking to the list it was counted from and equal to what that list shows.

## Why

Issue #36 (Beginner 14, the dashboard). The Overlord's brief: the state of the business at a glance, every number
taking you to the list behind it.

## Approach

No schema change. `deals.ts` gains `dealsPerStage` (one grouped query, zeros filled in) and `coldDealsTotal` (the
same where-clause as `cold=1`). Home loads them, `openDealsTotal`, `wonInMonth(monthIn(TIME_ZONE, now))` and
`dueTasks` in parallel with one `now`, and renders them in `home/ledger.tsx`: definition lists with hairline rules,
Young Serif tabular figures, muted labels, each figure a link whose name says what it counts.

## Tasks

### Task 1: Queries

- [x] **Step 1:** `dealsPerStage(db)` and `coldDealsTotal(db, now)` in deals.ts.
- [x] **Step 2:** Integration tests: stage counts with empty stages; each Home figure equals its list's figure.

### Task 2: Page

- [x] **Step 1:** `home/ledger.tsx`; Home loads the figures in parallel.
- [x] **Step 2:** Playwright: a Proposal deal; Home's Proposal number equals the rows at /deals?stage=Proposal; open
  deals equal /deals?open=1's figures; fits at 390px.

### Task 3: Checks

- [x] **Step 1:** typecheck, lint, test, test:e2e, build; seen at 390px and 1280px, light and dark.

## Acceptance

- [x] Each number equals what the list it opens shows, and each link opens that list filtered to match.

## Risks / open questions

- The going-cold count and the list read `now` a moment apart; a deal crossing the line in between could differ by
  one for a single load.
