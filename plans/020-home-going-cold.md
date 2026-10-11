# 020 — Going cold on Home

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

A "Going cold" section on Home, after Overdue and Due today: up to 10 deals from `coldDeals`, longest quiet first,
each with its title, company, value and "Nothing for 16 days"; "All 14 going cold" links to /deals?cold=1 when there
are more; "No deals going cold." when there are none.

## Why

Issue #37 (Beginner 14, the dashboard). Depends on #34's rule; nothing here restates it.

## Approach

`coldDeals(db, now, limit?)` gains a limit. Home reads the first `HOME_COLD_LIMIT` (10) and `coldDealsTotal` (#41's
ledger figure) with one `now`, so the ledger and "All N going cold" share one count, and renders the section after the
due tasks and renders a table from 768px and stacked rows
below, as the Deals list does. `quietDays` gives the number.

## Tasks

### Task 1: Data

- [x] **Step 1:** `coldDeals` limit; the count comes from `coldDealsTotal`.
- [x] **Step 2:** Integration test: order, cap of 10, count of 14; a call on a 15-day deal takes it off.

### Task 2: Page

- [x] **Step 1:** Going cold section on Home: table and phone rows, "All N going cold", empty line.
- [x] **Step 2:** Playwright: the section is on Home and a deal added now isn't in it, at 1280px and 390px.

### Task 3: Checks

- [x] **Step 1:** typecheck, lint, test, test:e2e, build; backdated deals seen at 390px and 1280px.

## Acceptance

- [x] A deal with nothing logged for 15 days shows with "Nothing for 15 days"; logging a call removes it.

## Risks / open questions

- "Nothing for N days" is always plural: a deal on Home has been quiet for at least 14 days.
