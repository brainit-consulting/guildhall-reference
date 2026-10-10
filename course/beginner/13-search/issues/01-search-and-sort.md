# Search and sort the lists

Finding someone shouldn't mean scrolling.

## What it should do
- A search box above the contacts, companies and deals tables. It matches names, emails, company names and deal
  titles, ignoring capitals, as you type.
- Click a column heading to sort by it; click again to reverse. An arrow shows the current sort.
- The search and sort are kept in the page's address, so a copied link opens the same view.
- "No matches for <text>." when nothing matches.

## Done when
- [ ] Typing "acme" finds Acme's contacts, company and deals in their lists.
- [ ] Sorting deals by value works both ways, and reloading keeps it.
- [ ] Tests: integration tests for the search queries; a Playwright test that searches and sorts.
- [ ] Tried in a browser
