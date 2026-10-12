# 040 — Invoices

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-12

## Goal

The owner bills a client from Guildhall: an invoice (`INV-0001` upwards, never reused) for a client and optionally one
of its projects, with lines, the business's tax rate copied on, and Draft, Sent, Paid; `/invoices` lists them with
overdue Sent ones marked.

## Why

Issue #93 (Intermediate chapter 11). The PDF (next issue) and the agent's `create_invoice_draft` (chapter 12) build on
these functions.

## Approach

Numbers come from a Postgres sequence, which never hands out a number twice, whatever is deleted or rolled back. A
one-row `business_settings` table holds the tax rate. `invoiceTotals` works in whole integers (BigInt) from the decimal
strings: each line and the tax are rounded half up to cents once, from their exact products. `src/lib/invoices.ts` holds the reads, writes and the status rule
(Draft to Sent to Paid; only a Draft is edited or deleted), each guarded in the `where` so a stale page can't skip it.

## Tasks

### Task 1: The rules and the data

- [x] **Step 1:** Schema: `business_settings`, the `invoice_number` sequence, `invoice`, `invoice_line`; a migration.
- [x] **Step 2:** `invoiceTotals`, `parseQuantity`, `parseTaxRate`, `invoiceNumber`, `isOverdue` with unit tests.
- [x] **Step 3:** `src/lib/settings.ts` (tax rate) and `src/lib/invoices.ts` (create, update, advance, delete, get,
  list); integration tests for numbering, statuses, the copied tax rate and each read and write. Demo reset clears
  invoices.

### Task 2: The pages

- [x] **Step 1:** Tax rate in Settings.
- [x] **Step 2:** Invoices in the menu; `/invoices`, `/invoices/new`, `/invoices/[id]`, `/invoices/[id]/edit`.
- [x] **Step 3:** "New invoice" and the client's invoices on a client's page; "New invoice" on a project's page.
- [x] **Step 4:** Playwright: three lines, the totals, Mark sent, Mark paid; tax rate in Settings.

## Acceptance

- [x] I can make an invoice with three lines, see the right totals, mark it sent, then paid.
- [x] Tried in a browser at 375px and desktop.

## Risks / open questions

- Rounding: each line is rounded half up from its exact quantity x price; the subtotal is the sum of those rounded
  lines; the tax is worked exactly from the subtotal and rounded once; the total is subtotal plus tax. The lines add
  to the subtotal and the subtotal and tax to the total, as printed. (QA round 1: the first version took the
  subtotal from the exact sum, so the printed lines could differ from it by a cent.)
- Status moves one way, one step at a time: Draft to Sent, Sent to Paid. No undo.
- Deleting a project leaves its invoices, without the project. A client with invoices can't be deleted (no page
  deletes clients; demo reset deletes invoices first).
- A new invoice is due 30 days after it is issued; both dates can be changed on the form.
- Demo reset doesn't restart the numbering: the sequence carries on, so a number is never reused.
