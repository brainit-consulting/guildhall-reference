# 033 — Reset demo data

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

With `DEMO_EMAIL` set, the owner's Settings page has a Reset demo data button that, after a question, replaces every
company, contact, deal, activity, task and enquiry with the Hollow Oak demo set, dated from today (issue #75).

## Why

The live showcase shares one demo account among students. When they've changed the data, the owner needs it back
with one button rather than a script run against the production database.

## Approach

A plain function `resetDemoData(db, who, demoEmail, now)` in `src/lib/demo-data.ts` refuses unless `DEMO_EMAIL` is set
and `who` is the owner, then deletes and inserts in one transaction. The data is the issue's seed script turned into
typed rows, with its day offsets computed by `todayIn(TIME_ZONE, …)`. Settings shows the section only when
`env.demoEmail` is set; the server action asks the same function, so a forged POST is refused too. No schema change.

## Tasks

### Task 1: the data and the rule

- [x] **Step 1:** `src/lib/demo-data.ts`: the Hollow Oak rows built from `now`, and `resetDemoData`.
- [x] **Step 2:** integration test: exact counts, accounts and allowed emails kept, owner credited, dates from today,
  refusals for a member and without `DEMO_EMAIL`, nothing deleted when refused.

### Task 2: Settings

- [x] **Step 1:** server action and a `ResetDemoData` client component with a `<dialog>` question.
- [x] **Step 2:** Settings shows the "Demo data" section only when `env.demoEmail` is set.

### Task 3: end to end

- [x] **Step 1:** `e2e/demo-reset.spec.ts` in its own Playwright project that runs after every other test, since a reset
  wipes what the others made: button, question, Cancel keeps data, Reset puts the demo set back.

## Acceptance

- [x] typecheck, lint, unit, integration, e2e and build pass.
- [x] Tried in a browser with `DEMO_EMAIL` set (button, question, Cancel, Reset) and without it (no section).

## Risks / open questions

- The seed script's `ago()` uses wall-clock offsets from `now`; kept exactly, so times of day match the live site.
