# 014 — Search and sort the Companies list

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

`/companies` has a Search box (name or website, any capitals, as you type) and headings that sort both ways, all kept
in the address (`?q=acme&sort=name&dir=desc`), built from pieces Contacts and Deals can reuse.

## Why

Issue #27 (Beginner 13, spec "tables with search, sorting ... kept in the address"). Two follow-up issues reuse the
pieces side by side, so they must be general and small.

## Approach

`src/lib/list-view.ts` holds the address rules as plain functions: read `{ q, sort, dir }` given a page's sort keys,
build a list URL with one thing changed and the rest kept, and escape `q` for ILIKE. The page reads `searchParams` on
the server and hands plain values down, so no component needs `useSearchParams`. `_lists/` has the search box (a GET
form that also navigates by itself after 300 ms with `router.replace`), the sortable heading (a link in the `<th>`)
and the phone "Sort by" (a `<details>` of links). No schema change, so no migration.

## Tasks

### Task 1: Rules

- [x] **Step 1:** `src/lib/list-view.ts` with `readListView`, `listHref`, `sortChanges`, `nextDir`, `likePattern`; unit tests.

### Task 2: Data

- [x] **Step 1:** `listCompanies(db, view?)`: search on name or website, sort by a column with blanks last; integration tests.

### Task 3: Page

- [x] **Step 1:** `_lists/search-box.tsx`, `_lists/sort-heading.tsx`, `_lists/sort-by.tsx`.
- [x] **Step 2:** `/companies` uses them; "No matches" with Clear search.

### Task 4: Tests and checks

- [x] **Step 1:** `e2e/companies-search.spec.ts`: search, sort both ways, reload, phone width.
- [x] **Step 2:** typecheck, lint, test, test:e2e, build; tried at 390px and 1280px.

## Acceptance

- [x] Typing "acme" filters without Enter, the box keeps focus, the address becomes `/companies?q=acme`.
- [x] Name sorts A to Z, then Z to A, with an arrow and `aria-sort`; a reload keeps it.
- [x] Search and sort combine; Clear search keeps the sort; junk parameters show the default list.
- [x] `%` and `_` match only themselves.

## Risks / open questions

- The phone "Sort by" also offers "Newest added first", so the default order can be got back there; the headings
  only cycle A to Z and Z to A, as the issue says.
- Ties after the sorted column break by name A to Z, then id, so the order never shuffles between loads.
- `dir=asc` is left out of the URLs the page builds, since a missing `dir` means `asc`.
