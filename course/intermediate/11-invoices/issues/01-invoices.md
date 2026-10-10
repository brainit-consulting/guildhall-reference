# Invoices

I want to bill my clients from Guildhall.

## What it should do
- An invoice has a number (`INV-0001`, `INV-0002`, … never reused, even after a delete), a client, an optional
  project, an issue date, a due date, lines (description, quantity, unit price) and a status: Draft, Sent or Paid.
- One tax rate for the business, set in Settings (for example 15%), copied onto each invoice when it's created so
  later changes don't alter old invoices.
- Totals (each line, subtotal, tax, total) are worked out by one function, `invoiceTotals(lines, taxRate)`, with exact
  money arithmetic (no floating point), rounded to cents only at the end.
- An Invoices item in the menu, opening `/invoices`: number, client, total, status and due date; overdue Sent invoices
  marked.
- "New invoice" on a client's or project's page and on `/invoices`. Only Drafts can be edited; "Mark sent" and
  "Mark paid" move them on. Only Drafts can be deleted.

## Done when
- [ ] I can make an invoice with three lines, see the right totals, mark it sent, then paid.
- [ ] Tests: unit tests for `invoiceTotals` (including 0.1 + 0.2 style amounts and rounding); integration tests for
  numbering and statuses; a Playwright test that creates one.
- [ ] Tried in a browser
