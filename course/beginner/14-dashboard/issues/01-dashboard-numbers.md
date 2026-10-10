# The numbers on Home

Home should tell me how the business is doing before I click anything.

## What it should do
- At the top of Home, above the tasks: open deals (count and total value), won this month (count and total value),
  and deals per stage (New, Contacted, Proposal, Won, Lost), each with its count.
- Every number is a link to the deals list filtered to match (for example, Proposal opens the deals list filtered to
  Proposal).
- "This month" is the business's local calendar month.

## Done when
- [ ] The numbers match the deals list, and each link opens the matching filtered list.
- [ ] Tests: integration tests for each number; a Playwright test that follows one link.
- [ ] Tried in a browser

Depends on #<number of the issue "Filter deals">
