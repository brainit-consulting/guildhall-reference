# Deals

A deal is a piece of work I hope to win. I want to see every deal, what it's worth and how far along it is.

## What it should do
- A Deals item in the menu, opening `/deals`: a table of title, company, value, stage and expected close date.
- "Add deal": title (required), value, stage, contact, company and expected close date.
- Stages are fixed, in this order: New, Contacted, Proposal, Won, Lost. A new deal starts at New.
- Value is money: stored exactly (`numeric(12,2)`), never as a floating-point number.
- Add `src/lib/money.ts` with `CURRENCY = "USD"` and `formatMoney(value: string): string`, so I can change the
  currency in one place. Every amount on screen goes through it.
- Above the table: the number of open deals (New, Contacted or Proposal) and their total value.
- A deal page with every field, "Edit" and "Delete".

## Done when
- [ ] I can add, edit and delete a deal, and the open total adds up.
- [ ] Changing `CURRENCY` to "ZAR" or "EUR" changes how every amount shows.
- [ ] Tests: unit tests for `formatMoney`; an integration test for the open-deals total; a Playwright test that adds a
  deal.
- [ ] Tried in a browser
