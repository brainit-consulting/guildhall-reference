# Clients

Once I win a deal, that business becomes a client I do work for and send invoices to.

## What it should do
- A Won deal's page gets "Make client". It creates a client from the deal's company (or, with no company, its
  contact) and links the deal to it. If that company is already a client, it links to the existing one instead.
- A Clients item in the menu, opening `/clients`: name, contact person, and the number of won deals.
- A client page: its details, its company and contact (linked), and its won deals.

## Done when
- [ ] "Make client" on a Won deal creates the client once; doing it on a second Won deal for the same company reuses
  it.
- [ ] Tests: integration tests for creating and reusing a client; a Playwright test for "Make client".
- [ ] Tried in a browser
