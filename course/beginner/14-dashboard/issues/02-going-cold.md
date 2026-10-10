# Going cold

Deals die quietly. Show me the ones nobody has touched for two weeks.

## What it should do
- A deal is going cold when it's open (New, Contacted or Proposal) and its last activity was 14 or more days ago, or
  it has never had one and was created 14 or more days ago.
- Write that rule once, as `isCold(deal, now)`, and use it everywhere.
- Home gets a "Going cold" list: each deal with its company, value and "nothing for 16 days".
- The deals table marks cold deals, and the deal filters get a "Going cold" option.

## Done when
- [ ] A deal with no activity for 15 days shows in Going cold; logging a call on it removes it.
- [ ] Tests: unit tests for `isCold`, including exactly 14 days and Won or Lost deals; a Playwright test for the Home
  list.
- [ ] Tried in a browser

Depends on #<number of the issue "Filter deals">
