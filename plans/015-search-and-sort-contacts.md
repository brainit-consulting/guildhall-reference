# 015 — Search and sort the Contacts list

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

`/contacts` has the Search box (name, email or company name, any capitals, as you type), headings that sort every
column both ways and the phone "Sort by", all kept in the address, using the pieces #27 built for Companies.

## Why

Issue #28 (Beginner 13). The shared rules (`src/lib/list-view.ts`) and components (`_lists/`) already exist; this
issue wires Contacts to them rather than building a second version.

## Approach

`listContacts(db, view?)` takes a `ContactView` like `listCompanies`: ILIKE on contact name, email and the joined
company's name; sort by a column with `lower(nullif(col, ''))` and `nulls last`, ties by name then id. No view keeps
newest first. The page reads the view from `searchParams` and uses SearchBox, SortHeading and SortBy. No schema change.

## Tasks

### Task 1: Data

- [x] **Step 1:** `CONTACT_SORTS` and `listContacts(db, view?)`; integration tests for search and every sort.

### Task 2: Page

- [x] **Step 1:** `/contacts` uses SearchBox, SortHeading, SortBy; "No matches" with Clear search.

### Task 3: Tests and checks

- [x] **Step 1:** `e2e/contacts-search.spec.ts`: search, sort by Company both ways, reload, phone width.
- [x] **Step 2:** typecheck, lint, test, test:e2e, build; tried at 390px and 1280px.

## Acceptance

- [x] Typing "acme" shows people at Acme and anyone with "acme" in their name or email; the address keeps it.
- [x] Company sorts both ways with no-company contacts last; reload and a copied link keep the view.
- [x] Search and sort combine.
- [x] At 390px nothing scrolls sideways and "Sort by" works.

## Risks / open questions

- Job title's address key is `title` (`?sort=title`), short and readable in a shared link.
