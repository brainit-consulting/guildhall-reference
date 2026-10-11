# 018 — Tasks page: overdue and due today

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

`/tasks?due=overdue` and `/tasks?due=today` list exactly Home's Overdue and Due today tasks, picked from a "Due"
select beside Show done and kept in the address.

## Why

Issue #35 (Beginner 14, the dashboard). Home's task counts will link here, so the page needs a view that can't
disagree with Home.

## Approach

`src/lib/tasks.ts` gets `readTaskDue(value)` (anything but `overdue` or `today` is null) and `listDueTasks(db, due,
today)`, which returns one half of `dueTasks`, so the rule lives in one place. The page reads `due`, works out today
with `todayIn(TIME_ZONE, now)`, hides Show done and changes the heading and empty state. The select is a small client
file next to the page, a GET form like the Deals Stage filter. No schema change, so no migration.

## Tasks

### Task 1: Data

- [x] **Step 1:** `TASK_DUES`, `readTaskDue`, `listDueTasks`.
- [x] **Step 2:** Unit test for `readTaskDue`; integration test that `listDueTasks` equals `dueTasks` for the same day.

### Task 2: Page

- [x] **Step 1:** `tasks/due-filter.tsx`: Due select (Any day, Overdue, Due today), keeping other parameters.
- [x] **Step 2:** `/tasks` uses it; heading, hidden Show done, empty state with a link back to all tasks.

### Task 3: Tests and checks

- [x] **Step 1:** `e2e/tasks-due.spec.ts`: yesterday, today, tomorrow; pick Due today; reload; junk value; tick off.
- [x] **Step 2:** typecheck, lint, test, test:e2e, build; tried in a browser.

## Acceptance

- [x] `/tasks?due=today` and `/tasks?due=overdue` match Home; reload and a copied link keep the view.
- [x] `/tasks?due=junk` shows the normal list.

## Risks / open questions

- With `due` set, `done=show` stays in the address but is ignored, so picking Any day brings back what was there.
