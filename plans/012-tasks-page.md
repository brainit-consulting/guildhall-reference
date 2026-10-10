# 012 — The Tasks page

**Status:** in-progress
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

`/tasks` lists every open task by due date with what it belongs to and a tick box, "Show done" (kept in the URL as
`?done=show`) adds the done ones, and Add task there picks the contact, company or deal it is for.

## Why

Issue #22 (spec B12): one place to see every promise still open. It builds on #21 (plan 011): no second query, form
or tick box.

## Approach

`src/lib/tasks.ts` gains the picker's choices across the three kinds (`listTaskTargetChoices`, values like
`deal:<id>`), `readTarget` to turn such a value back into a target, and `createTaskOn` for a picked value. The Add task
form takes either a fixed target or the choices; the tick box moves out of `TaskItem` so a table row can use it.

## Tasks

### Task 1: Data

- [ ] **Step 1:** `listTaskTargetChoices`, `readTarget`, `createTaskOn` in `src/lib/tasks.ts`; unit and integration tests.

### Task 2: Page

- [ ] **Step 1:** "Tasks" in `MENU` after Pipeline; `menu.test.ts`.
- [ ] **Step 2:** `addTaskAction` takes a picked value when it has no target; the form shows the picker then.
- [ ] **Step 3:** The tick box as its own component; `/tasks` with the table (stacked under 768px), Show done, empty state.

### Task 3: Tests and checks

- [ ] **Step 1:** `e2e/tasks-page.spec.ts`; the menu's current item on `/tasks`.
- [ ] **Step 2:** typecheck, lint, test, test:e2e, build; tried at 390px and 1280px, light and dark.

## Acceptance

- [ ] A task added on a deal shows on `/tasks` and on the deal, and ticks off from either.
- [ ] A task added from `/tasks` on a picked company shows on `/tasks` and on the company page.
- [ ] Show done lists ticked tasks; unticking one reopens it; a reload keeps the switch.
- [ ] Tasks is the current menu item on `/tasks`, desktop and phone.

## Risks / open questions

- Show done is a GET form with one button (`next/form`), so it works from the keyboard and without JavaScript.
- With Show done on, the done tasks sit among the open ones in due-date order rather than in a block of their own.
- Picker choices are sorted A to Z by name across the three kinds; a contact's or deal's company follows its kind to
  tell two of one name apart.
