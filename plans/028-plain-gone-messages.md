# 028 — Plain words when a record has gone

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

The sentences an owner sees when a record has been deleted name nobody: no "Guildhall", no business name.

## Why

Issue #59, chapter 17 part 3. The app names itself after the business now, and "That contact isn't in Hollow Oak
Joinery any more" reads badly, so these sentences say what happened instead.

## Approach

Swap "isn't in Guildhall any more" for "has been deleted" in the gone messages (activities, tasks, deals, contacts,
the task action); drop "in Guildhall" from the delete-company dialog, keeping its one/many wording; the timeline's
missing author reads "Someone who no longer has an account". Comments keep "Guildhall". Tab titles, sign-in and
`src/lib/brand.ts` are other issues.

## Tasks

### Task 1: The words

- [x] **Step 1:** `activities.ts`, `tasks.ts`, `deals.ts`, `contacts.ts`, `_tasks/actions.ts`.
- [x] **Step 2:** `delete-company.tsx` and `_activities/activities.tsx`.

### Task 2: The tests

- [x] **Step 1:** `activities.integration.test.ts`, `tasks.integration.test.ts`, `contacts.test.ts`,
  `contacts.integration.test.ts`.
- [x] **Step 2:** `e2e/company-contacts.spec.ts`, and only the one line in `e2e/enquire.spec.ts`.

## Acceptance

- [x] None of the listed sentences says "Guildhall".
- [x] Delete a contact in one tab, log an activity on it in another: the new sentence shows under the form.
- [x] Delete a company with contacts: the dialog reads "Its 1 contact stays, with no company."
- [x] typecheck, lint, test, test:e2e and build pass.

## Risks / open questions

- None. `enquire.spec.ts` is also edited by #57; only one line is touched here, so a merge stays simple.
