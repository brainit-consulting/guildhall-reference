# Filter deals

I often only want to see one stage, or the deals still in play.

## What it should do
- Above the deals table: a stage filter (any stage, or one of New, Contacted, Proposal, Won, Lost) and an "Open only"
  switch.
- Filters combine with the search and sort, and are kept in the address like them.
- The open-deals total above the table follows the filters.

## Done when
- [ ] Choosing Proposal shows only Proposal deals; "Open only" hides Won and Lost; a copied link keeps both.
- [ ] Tests: integration tests for the filters; a Playwright test that filters by stage.
- [ ] Tried in a browser

Depends on #<number of the issue "Search and sort the lists">
