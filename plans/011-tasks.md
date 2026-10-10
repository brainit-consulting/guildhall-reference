# 011 — Tasks on contacts, companies and deals

**Status:** in-progress
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

Every contact, company and deal page has a Tasks section above Activity: its open tasks by due date, each with a tick
box, then "Add task" (title and due date). Ticking a task saves at once and it leaves the list.

## Why

Issue #21 (spec B12). The Tasks page, Home's Overdue / Due today, the B16 automations and the MCP `list_tasks_due`
tool all build on this, so adding, ticking and listing live in plain functions on `db`, and the form and task line in
`src/app/(signed-in)/_tasks/` for the follow-ups to reuse.

## Approach

One `task` table: title, `due_on` (date), `done_at` (null while open), exactly one of contact, company or deal (check
constraint), deleted with it. `src/lib/tasks.ts` holds `checkTask`, `addTask` (already checked; for B16),
`createTask` (the form's: checks first), `setTaskDone` and `listTasks` (filter by record, open/done, due on or
before a day; sorted by due date then title; each with what it belongs to and its name).

## Tasks

### Task 1: Data

- [x] **Step 1:** `task` in `schema.ts`; `npm run db:generate`. `isDay` moves to `src/lib/dates.ts` so deals and
  tasks share it.
- [x] **Step 2:** `src/lib/tasks.ts`; `tasks.test.ts` (checkTask) and `tasks.integration.test.ts`.

### Task 2: Pages

- [ ] **Step 1:** `src/app/(signed-in)/_tasks/`: server actions, Add task form, task line with tick box, the section.
- [ ] **Step 2:** The section on the contact, company and deal pages, above Activity.

### Task 3: Tests and checks

- [ ] **Step 1:** `e2e/tasks.spec.ts`.
- [ ] **Step 2:** typecheck, lint, test, test:e2e, build; tried in a browser at 390px and 1280px, light and dark.

## Acceptance

- [ ] A task added on a deal shows under its Tasks after a reload; ticking it removes it for good.
- [ ] The same on a contact and a company.
- [ ] A blank title or no due date is explained by the field, and what was typed is kept.
- [ ] Deleting the record deletes its tasks.

## Risks / open questions

- Ticking needs JavaScript (a checkbox can't post a form on its own); the Add task form works without it.
- Ticking an already-done task keeps the time it was first done.
- Titles sort case-insensitively, so "call Ann" doesn't sort after "Visit".
