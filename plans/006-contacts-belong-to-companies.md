# 006 — Contacts belong to companies

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

A contact can be put in a company from its form; the contacts table and the contact's page show that company as a
link, and the company's page lists its contacts. Deleting a company keeps its contacts, with no company.

## Why

Issue #10 (spec B8, data table: a contact has an optional company). Deals, activities and the MCP `get_company` tool
will read the same link, so it lives in `contact.company_id` and plain functions on `db`.

## Approach

`contact.company_id` references `company.id` with `on delete set null`, so the database itself keeps contacts when
their company goes. `ContactInput` gains `companyId` ("" for no company); `checkContact` refuses anything that isn't
a uuid, and create/update refuse a company that isn't there any more. The form gets a small combobox (no new library):
type to narrow the list of companies, or pick "No company"; it posts the chosen id in a hidden field.

## Tasks

### Task 1: Data

- [x] **Step 1:** `contact.companyId` in the schema; `npm run db:generate` (0004).
- [x] **Step 2:** `src/lib/contacts.ts`: `companyId` in the input and checks; list and get return the company's name;
  create/update refuse a missing company.
- [x] **Step 3:** `src/lib/companies.ts`: `listCompanyChoices` (by name, for the picker) and `listCompanyContacts`
  (its length is the count the delete question uses).
- [x] **Step 4:** unit and integration tests: linking, unlinking, a missing company, deleting a company with contacts.

### Task 2: Pages

- [x] **Step 1:** `company-picker.tsx` combobox; the contact form's Company field.
- [x] **Step 2:** contacts table and stacked rows show the company, linked.
- [x] **Step 3:** the contact's page shows its company, linked.
- [x] **Step 4:** the company's page lists its contacts; "Add contact" there starts the form with the company picked.
- [x] **Step 5:** the delete question says how many contacts stay.

### Task 3: Tests

- [x] **Step 1:** `e2e/company-contacts.spec.ts`: pick a company on the contact form by typing, see it on both pages,
  delete the company and the contact stays with no company.

## Acceptance

- [x] I can put a contact in a company and see them on the company's page.
- [x] Deleting the company leaves the contact in place with no company.
- [x] typecheck, lint, test, test:e2e, build pass; tried in a browser.

## Risks / open questions

- Two companies with the same name look the same in the picker; the website is shown beside the name to tell them
  apart when there is one.
- Search and sorting on the tables are a later issue (spec: tables with search); the picker only narrows its own list.
- A company deleted between the check in create/update and the insert would still fail on the foreign key; the
  window is a few milliseconds and the error page is acceptable there.
