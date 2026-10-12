# 039 — Projects

**Status:** in-progress
**Owner:** Aldric the Smith
**Last updated:** 2026-10-12

## Goal

A client's work comes in projects (name, client, Active or Done, budget, start and end dates, the end never before the
start): "Add project" on a client's page, the client page lists them, `/projects` lists them all Active first, and a
project page has Edit, Mark done and Delete (asks first).

## Why

Issue #90 (Intermediate chapter 10). Invoices (next issue) can point at a project.

## Approach

A `project` table with a check constraint `end_on >= start_on`, so the date rule holds whoever writes; `checkProject`
says it in words first. `src/lib/projects.ts` holds the reads and writes on `db` (shared later by `list_projects`).
Pages follow the deals pattern: a shared form, server actions that call `requireSession()`, a `<dialog>` to confirm
Delete.

## Tasks

### Task 1: The rule

- [x] **Step 1:** `project` in the schema, a migration.
- [x] **Step 2:** `src/lib/projects.ts`: `checkProject`, `createProject`, `updateProject`, `setProjectStatus`,
  `deleteProject`, `getProject`, `listProjects`, `listClientProjects`; demo reset clears projects.
- [x] **Step 3:** Unit tests for `checkProject`; integration tests for every read and write and the date rule (also
  at the database).

### Task 2: The pages

- [ ] **Step 1:** Projects in the menu; `/projects`; `/projects/new?client=`; `/projects/[id]`; `/projects/[id]/edit`.
- [ ] **Step 2:** Projects section with "Add project" on the client page.
- [ ] **Step 3:** Playwright: add a project from a client's page, see it on `/projects` and the client page, mark it
  done, delete it.

## Acceptance

- [ ] I can add a project to a client, see it on `/projects` and the client's page, and mark it done.
- [ ] Tried in a browser at 375px and desktop.

## Risks / open questions

- Budget, start and end are all required: the issue says a project has them. A budget of 0 is allowed.
- A Done project shows "Mark active", so a mistaken Mark done can be undone without the Edit form.
- Edit can move a project to another client; the form offers every client.
- Deleting a client (no page does yet) deletes its projects.
