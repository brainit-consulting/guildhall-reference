# 005 — Companies

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

A Companies item in the menu opens `/companies`, where I can add, view, edit and delete the businesses my contacts
work for.

## Why

Issue #9 (spec B8). Contacts, deals, activities and tasks will point at companies, and the MCP `get_company` tool will
read them, so the reads and writes live in plain functions on `db`, as contacts do (plan 004).

## Approach

A `company` table (name required; website, phone, notes optional). `src/lib/companies.ts` holds `checkCompany` (pure,
unit tested), `websiteHref` (turns what was typed into a safe link, unit tested) and list/get/create/update/delete on
`db` (integration tests). Pages under `(signed-in)/companies` follow the contacts pages: the table (stacked rows under
768px), `new`, `[id]` and `[id]/edit`, one shared form, and a Delete dialog asking "Delete <name>? This can't be
undone."

## Tasks

### Task 1: Data

- [x] **Step 1:** `company` in `src/lib/db/schema.ts`; `npm run db:generate`.
- [x] **Step 2:** `src/lib/companies.ts`: `checkCompany`, `websiteHref`, `listCompanies`, `getCompany`,
  `createCompany`, `updateCompany`, `deleteCompany`.
- [x] **Step 3:** `src/lib/companies.test.ts` and `src/lib/companies.integration.test.ts`.

### Task 2: Pages

- [x] **Step 1:** Companies in `MENU`, after Contacts.
- [x] **Step 2:** `/companies` table, newest first, with the empty state.
- [x] **Step 3:** `/companies/new` and `/companies/[id]/edit` sharing `company-form.tsx`.
- [x] **Step 4:** `/companies/[id]`: every field, the website as a link, Edit, Delete with the confirmation dialog.

### Task 3: Tests

- [x] **Step 1:** `e2e/companies.spec.ts`: add, edit, delete; a missing name is explained; phone width; signed out
  goes to sign-in.

## Acceptance

- [x] I can add, view, edit and delete a company.
- [x] typecheck, lint, test, test:e2e, build pass; tried in a browser.

## Risks / open questions

- Linking a contact to its company (spec's data table: contact has an optional company) is not in issue #9; left for
  the issue that asks for it.
- The website is stored as typed. Only http(s) addresses become links; "guildhall.example" links to
  `https://guildhall.example`, anything else (say `javascript:`) shows as plain text.
