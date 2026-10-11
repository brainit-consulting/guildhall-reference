# 016 — Search, sort and filter the Deals list

**Status:** in-progress
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

`/deals` has the Search box, sortable headings and phone "Sort by" from #27, plus a Stage select and an "Open only"
switch, all kept in the address (`?q=acme&stage=Proposal&open=1&sort=value&dir=desc`), and the open count and value
follow whatever the table shows.

## Why

Issue #29 (Beginner 13, "Search and sort the lists" and "Filter deals"). The pipeline board and the unfiltered total
must not change.

## Approach

`src/lib/deals.ts` gets `DEAL_SORTS`, `readDealView(params)` (the list view plus `stage` and `open`) and one
`dealWhere(view)` that both `listDeals(db, view?)` and `openDealsTotal(db, view?)` use, so the table and the total
can't drift apart. With no view both behave exactly as today. Sorting: text ignoring capitals, value as numeric, stage
by its place in DEAL_STAGES, dates as dates, blanks last both ways, ties by title then id. The page reuses `_lists/`;
the filters are a small client file next to the page. `SortBy` learns optional per-column direction words, since
"Value, A to Z" reads wrong. No schema change, so no migration.

## Tasks

### Task 1: Data

- [ ] **Step 1:** `readDealView`, `dealWhere`, `listDeals(db, view?)`, `openDealsTotal(db, view?)`.
- [ ] **Step 2:** Unit tests for `readDealView`; integration tests for search, each sort, stage, Open only, combined, total.

### Task 2: Page

- [ ] **Step 1:** `SortBy` takes optional `asc`/`desc` words per column.
- [ ] **Step 2:** `deals/deal-filters.tsx`: Stage select and Open only switch, each keeping the other parameters.
- [ ] **Step 3:** `/deals` uses Search, headings, Sort by, filters; "No deals match" with a clear link that keeps the sort.

### Task 3: Tests and checks

- [ ] **Step 1:** `e2e/deals-search.spec.ts`: search, stage, Open only, value both ways, reload, phone width.
- [ ] **Step 2:** typecheck, lint, test, test:e2e, build; tried at 390px and 1280px.

## Acceptance

- [ ] "acme" finds deals by title, company name, contact name or email.
- [ ] Stage and Open only filter, combine with search and sort, and survive a copied link.
- [ ] Value sorts as money both ways, blanks last; reload keeps it.
- [ ] Open deals and Open value follow the search and filters.
- [ ] `/pipeline` unchanged.

## Risks / open questions

- `open=1` is the only value that turns the switch on; anything else is ignored, like an unknown stage.
