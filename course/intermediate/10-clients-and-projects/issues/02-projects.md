# Projects

The work I do for a client comes in projects, each with a budget and dates.

## What it should do
- A project has a name, a client, a status (Active or Done), a budget (money, `numeric(12,2)`), a start date and an
  end date (the end can't be before the start).
- "Add project" on a client's page; the client page lists its projects.
- A Projects item in the menu, opening `/projects`: name, client, status, budget and dates, Active first.
- A project page with "Edit", "Mark done" and "Delete" (asks first).

## Done when
- [ ] I can add a project to a client, see it on `/projects` and the client's page, and mark it done.
- [ ] Tests: integration tests for projects and the date rule; a Playwright test that adds one.
- [ ] Tried in a browser

Depends on #<number of the issue "Clients">
