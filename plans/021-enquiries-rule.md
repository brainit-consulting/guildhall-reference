# 021 — Enquiries: the rule

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

`receiveEnquiry(db, input, now)` turns a sent enquiry into a contact (reused by email), a New deal "Enquiry from
<name>" with source "Web form", and the message as a note on it; bots and floods are quietly ignored. No page yet.

## Why

Issue #43 (chapter 15, part 1 of 3; spec B15). The /enquire page in the next issue only has to call this.

## Approach

`deal.source` (text, null for hand-added deals) and an `enquiry` table (email, the business's day, deal set null on
delete) in one new migration. `src/lib/enquiries.ts` holds `checkEnquiry` (trim, required fields, caps) and
`receiveEnquiry`: trap, check, the 5-a-day count, then contact, company, deal, note and enquiry row in one transaction.

## Tasks

### Task 1: Schema

- [x] **Step 1:** `deal.source`, `enquiry` table with its (email, received_on) index; `npm run db:generate`.

### Task 2: Rule

- [x] **Step 1:** `checkEnquiry` and its unit tests.
- [x] **Step 2:** `receiveEnquiry` and its integration tests (the issue's list).

### Task 3: Checks

- [x] **Step 1:** typecheck, lint, test, test:e2e, build; the dev server starts on an existing .data.

## Acceptance

- [x] A first enquiry makes the contact, company, deal (New, "Web form") and note; the sixth in a day adds nothing.
- [x] Existing deals read source null after the migration.

## Risks / open questions

- The count is read before the transaction, so two enquiries sent at the same instant could both pass at the fifth.
  The limit is a brake on floods, not an exact quota; one extra is acceptable.
