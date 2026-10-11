# 024 — Automated tasks: marked, and once only

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

The `task` table can say which tasks Guildhall added itself, and the database refuses a second won follow-up on a
deal or a second check-in for the same cold spell. Nothing a person sees changes.

## Why

Issue #51, the groundwork for B16's two automations; the won follow-up and the cold check-in are built next, in parallel. "Once"
lives in unique indexes, not a select-then-insert, so two tabs moving a deal to Won at the same moment still make one
task.

## Approach

`src/lib/task-automations.ts` (no imports, like `activity-kinds.ts`) holds the automation names and the two titles.
The schema adds `task.automation` (pgEnum from that list, null for a person's task) and `task.cold_since` (the deal's
`coalesce(last_activity_at, created_at)` when the check-in was made), two partial unique indexes and two checks. The
checks are written with `is null` / `is not distinct from` so a null `automation` can't pass them by evaluating to null.

## Tasks

### Task 1: Names and titles

- [x] **Step 1:** `task-automations.ts` with `TASK_AUTOMATIONS`, `wonFollowUpTitle`, `checkInTitle`.
- [x] **Step 2:** `task-automations.test.ts`: each title with a contact, with only a company, with neither.

### Task 2: Schema

- [x] **Step 1:** `automation`, `cold_since`, the two unique indexes and two checks on `task`; `npm run db:generate` (0012).
- [x] **Step 2:** `task-automations.integration.test.ts`: every bad row refused by the constraint meant to refuse it;
  a second cold spell and any number of a person's tasks on one deal save.

## Acceptance

- [x] `npm run dev` on an existing `.data` applies 0012 and existing tasks show as before.
- [x] typecheck, lint, test, test:e2e and build pass.

## Risks / open questions

- A check passes when it evaluates to null. `(automation = 'cold_check_in') = (cold_since is not null)` would let a
  person's task carry a `cold_since`, so the check uses `is not distinct from`; the tests cover that row.
