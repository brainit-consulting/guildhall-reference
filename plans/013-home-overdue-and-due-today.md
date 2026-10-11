# 013 — Overdue and Due today on Home

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

Home shows two sections under the welcome: Overdue (open tasks due before the business's today, oldest first) and Due
today, each line with what it belongs to as a link and the tick box. Nothing in either: "Nothing due today."

## Why

Issue #23 (spec B12). "Today" is the business's calendar day, not the server's (UTC on Vercel) or the browser's. B14
and B16 will reuse the date helpers.

## Approach

`TIME_ZONE`, `todayIn(timeZone, now)` and `dueWhen(dueOn, today)` in `src/lib/dates.ts`. `dueTasks(db, today)` in
`src/lib/tasks.ts` reads open tasks due by today through `listTasks` and splits them with `dueWhen`. Home is already
dynamic (`requireSession` reads the request headers), and works out today on each render.

## Tasks

### Task 1: Rules and data

- [x] **Step 1:** `TIME_ZONE`, `todayIn`, `dueWhen` and their unit tests.
- [x] **Step 2:** `dueTasks` and its integration test.

### Task 2: Page

- [x] **Step 1:** Home's Overdue and Due today sections, reusing `TaskItem`.

### Task 3: Tests and checks

- [x] **Step 1:** `e2e/home.spec.ts`.
- [x] **Step 2:** typecheck, lint, test, test:e2e, build; tried in a browser at 390px and 1280px, light and dark.

## Acceptance

- [x] A task due yesterday shows under Overdue, one due today under Due today, one due tomorrow on neither; ticking
  one removes it from Home.
- [x] With nothing overdue or due today, Home says "Nothing due today."

## Risks / open questions

- `TIME_ZONE` is a constant in code (the issue says so), not a setting: one line to change per business.
