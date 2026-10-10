# 004 — Contacts

**Status:** in-progress
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

A Contacts item in the menu opens `/contacts`, where I can add, view, edit and delete the people I deal with.

## Why

Issue #7 (spec B7). Companies, deals, activities and the MCP `add_contact` / `get_contact` tools all build on this
table, so the reads and writes live in plain functions on `db`.

## Approach

A `contact` table (name required; email, phone, job title, notes optional). `src/lib/contacts.ts` holds the check of
a submitted form (a pure function with unit tests) and list/get/create/update/delete on `db` (integration tests).
Pages under `(signed-in)/contacts`: the table, `new`, `[id]` and `[id]/edit`; one client form component serves add
and edit. Delete opens a dialog asking "Delete <name>? This can't be undone." before the server action runs.

## Tasks

### Task 1: Data

- [ ] **Step 1:** `contact` in `src/lib/db/schema.ts`; `npm run db:generate`.
- [ ] **Step 2:** `src/lib/contacts.ts`: `checkContact`, `listContacts`, `getContact`, `createContact`,
  `updateContact`, `deleteContact`.
- [ ] **Step 3:** `src/lib/contacts.test.ts` and `src/lib/contacts.integration.test.ts`.

### Task 2: Pages

- [ ] **Step 1:** Contacts in `MENU`.
- [ ] **Step 2:** `/contacts` table, newest first, with the empty state.
- [ ] **Step 3:** `/contacts/new` and `/contacts/[id]/edit` sharing `contact-form.tsx`; server actions check the
  session themselves.
- [ ] **Step 4:** `/contacts/[id]`: every field, Edit, Delete with the confirmation dialog.

### Task 3: Tests

- [ ] **Step 1:** `e2e/contacts.spec.ts`: add, edit, delete; a bad email is explained; signed out goes to sign-in.

## Acceptance

- [ ] I can add, view, edit and delete a contact.
- [ ] typecheck, lint, test, test:e2e, build pass; tried in a browser.

## Risks / open questions

- An unknown or malformed id in the URL shows the 404 page rather than an error.
- Every signed-in person sees and changes every contact: one business per copy (spec), no per-person ownership.
